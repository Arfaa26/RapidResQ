import io
import numpy as np
import pytest
from PIL import Image
from video.decoder import sample_video, VideoError
from video.analysis import analyze_frames
from video.temporal import TemporalClassifier
from detector.model import ObjectDetector, decode_predictions


def clip(seconds=3, format='mp4', codec='mpeg4'):
    import av
    buffer = io.BytesIO()
    with av.open(buffer, 'w', format=format) as container:
        stream = container.add_stream(codec, rate=6)
        stream.width, stream.height, stream.pix_fmt = 64, 64, 'yuv420p'
        for i in range(seconds * 6):
            pixels = np.zeros((64, 64, 3), dtype=np.uint8)
            pixels[:, :, i % 3] = 50 + (i * 7) % 200
            frame = av.VideoFrame.from_ndarray(pixels, format='rgb24')
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)
    return buffer.getvalue()


def test_real_video_decode_has_six_ordered_timestamps():
    result = sample_video(clip())
    assert result['durationSeconds'] == pytest.approx(3)
    assert len(result['frames']) == 6
    timestamps = [t for t, _ in result['frames']]
    assert timestamps == sorted(set(timestamps))
    assert timestamps[-1] >= 2.4
    assert all(image.mode == 'RGB' for _, image in result['frames'])


def test_invalid_and_long_videos_are_explicit():
    with pytest.raises(VideoError):
        sample_video(b'not a video')
    with pytest.raises(VideoError, match='30 seconds'):
        sample_video(clip(31))
    with pytest.raises(VideoError, match='4 MB'):
        sample_video(b'x' * (4 * 1024 * 1024 + 1))


def test_frame_disagreement_abstains_even_with_high_individual_scores():
    class Classifier:
        def predict(self, image):
            label = 'FIRE' if image.getpixel((0, 0))[0] else 'FLOOD'
            return {'status': 'ready', 'modelVersion': 'fixture', 'label': label, 'uncertain': False,
                    'probabilities': {'FIRE': .98 if label == 'FIRE' else .01, 'FLOOD': .98 if label == 'FLOOD' else .01, 'HAZARD': .01}}
    sample = {'durationSeconds': 3, 'frames': [(0, Image.new('RGB', (8, 8), 'red')), (2, Image.new('RGB', (8, 8), 'black'))]}
    result, details = analyze_frames(sample, Classifier())
    assert result['uncertain'] and details['disagreement']
    assert sum(result['probabilities'].values()) == pytest.approx(1)
    assert len(result['top3']) == 3
    assert details['audioAnalyzed'] is False


def test_missing_models_do_not_create_detections_or_temporal_scores(tmp_path):
    assert ObjectDetector(tmp_path).predict(Image.new('RGB', (64, 64)))['detections'] == []
    prediction = TemporalClassifier(tmp_path, 'fixture').predict([])
    assert prediction['status'] == 'training_required'
    assert 'anomalyScore' not in prediction


def test_yolox_decoding_filters_objects_and_bounds_boxes():
    outputs = np.zeros((3549, 85), dtype=np.float32)
    outputs[0, :4] = [2, 2, 1, 1]
    outputs[0, 4] = .9
    outputs[0, 5] = .9
    result = decode_predictions(outputs, 1, 416, 416)
    assert len(result) == 1 and result[0]['label'] == 'person'
    assert result[0]['confidence'] == pytest.approx(.81)
    assert all(0 <= p <= 1 for p in result[0]['box'])
