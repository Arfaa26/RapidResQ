"""Bounded, local-only video sampling in a disposable process. No audio decoding."""
import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

MAX_SECONDS = 30
MAX_FRAMES = 6
MAX_PIXELS = 1920 * 1080
MAX_BYTES = 4 * 1024 * 1024


class VideoError(ValueError):
    pass


def decode_file(path, output, max_seconds=MAX_SECONDS):
    import av
    # Local file input and a file-only protocol whitelist prevent network fetches.
    demuxers = 'mov,matroska,webm' + (',avi' if max_seconds > MAX_SECONDS else '')
    with av.open(str(path), options={'protocol_whitelist': 'file', 'format_whitelist': demuxers,
                                    'enable_drefs': '0', 'use_absolute_path': '0', 'max_streams': '8', 'threads': '1'}) as container:
        allowed = {'mov', 'mp4', 'matroska', 'webm'} | ({'avi'} if max_seconds > MAX_SECONDS else set())
        if not set(container.format.name.split(',')) & allowed:
            raise VideoError('Use an MP4, MOV or WebM clip.')
        if not container.streams.video:
            raise VideoError('The file has no video track.')
        stream = container.streams.video[0]
        stream.thread_count = 1
        if stream.width * stream.height > MAX_PIXELS or min(stream.width, stream.height) <= 0:
            raise VideoError('Use a video at 1080p or lower.')
        duration = float(stream.duration * stream.time_base) if stream.duration else (container.duration or 0) / av.time_base
        if not math.isfinite(duration) or duration <= 0:
            raise VideoError('Video duration could not be read; export the clip as MP4.')
        if duration > max_seconds + .05:
            raise VideoError('Trim the video to 30 seconds or less.')
        start = float((stream.start_time or 0) * stream.time_base)
        targets = [duration * i / MAX_FRAMES for i in range(MAX_FRAMES)]
        frames, seen = [], set()
        for target in targets:
            container.seek(int((target + start) / stream.time_base), stream=stream, backward=True)
            # A hard decode budget protects against deceptive duration/frame-rate metadata.
            for count, frame in enumerate(container.decode(stream)):
                if count >= 360:
                    raise VideoError('Video encoding is too complex; export a shorter MP4 clip.')
                if frame.width * frame.height > MAX_PIXELS:
                    raise VideoError('Use a video at 1080p or lower.')
                if frame.time is None:
                    continue
                timestamp = float(frame.time) - start
                if timestamp + .001 < target:
                    continue
                if timestamp < 0 or timestamp > max_seconds + .05:
                    raise VideoError('Video timestamps are invalid.')
                if frame.pts not in seen:
                    seen.add(frame.pts)
                    image = frame.to_image()
                    # PyAV exposes the display-matrix rotation in degrees counterclockwise.
                    rotation = getattr(frame, 'rotation', 0)
                    if rotation:
                        image = image.rotate(rotation, expand=True)
                    image.thumbnail((640, 640))
                    name = f'{len(frames)}.jpg'
                    image.save(output / name, quality=90)
                    frames.append({'file': name, 'timestampSeconds': round(timestamp, 3)})
                break
        if not frames:
            raise VideoError('No readable video frames were found.')
        return {'durationSeconds': round(duration, 3), 'frames': frames}


def sample_video(raw):
    from PIL import Image
    if not raw or len(raw) > MAX_BYTES:
        raise VideoError('Use a video smaller than 4 MB.')
    with tempfile.TemporaryDirectory(prefix='rapidresq-video-') as directory:
        root = Path(directory)
        (root / 'input').write_bytes(raw)
        try:
            process = subprocess.run([sys.executable, str(Path(__file__).resolve()), str(root)],
                                     capture_output=True, timeout=12, check=False)
        except subprocess.TimeoutExpired:
            raise VideoError('Video decoding timed out; try a shorter clip.') from None
        if process.returncode or not (root / 'result.json').exists():
            raise VideoError('The video could not be decoded; export a short MP4, MOV or WebM clip.')
        data = json.loads((root / 'result.json').read_text())
        if 'error' in data:
            raise VideoError(data['error'])
        frames = []
        for frame in data['frames']:
            with Image.open(root / frame['file']) as image:
                frames.append((frame['timestampSeconds'], image.convert('RGB').copy()))
        return {'durationSeconds': data['durationSeconds'], 'frames': frames}


if __name__ == '__main__':
    root = Path(sys.argv[1])
    try:
        # Linux process limits complement the parent wall-clock timeout.
        if sys.platform == 'linux':
            import resource
            resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
            resource.setrlimit(resource.RLIMIT_AS, (2 * 1024**3, 2 * 1024**3))
        result = decode_file(root / 'input', root)
    except VideoError as error:
        result = {'error': str(error)}
    except Exception:
        result = {'error': 'The video is unreadable or damaged; export a short MP4 clip.'}
    (root / 'result.json').write_text(json.dumps(result))
