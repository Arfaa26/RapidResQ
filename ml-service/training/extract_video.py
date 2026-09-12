"""Offline, local footage -> six ordered scene-score features using the serving backbone."""
import argparse
import json
import tempfile
from pathlib import Path
import numpy as np
from PIL import Image
from pretrained.models import PretrainedImageClassifier
from training.video_data import read_videos
from video.decoder import decode_file
from video.temporal import FEATURE_LABELS


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--model-dir', type=Path, default=Path('models/pretrained/image'))
    args = parser.parse_args()
    rows, manifest_hash = read_videos(args.manifest)
    classifier = PretrainedImageClassifier(args.model_dir)
    if classifier.model is None:
        raise ValueError('Install the pinned image backbone first')
    args.output.mkdir(parents=True, exist_ok=True)
    for index, row in enumerate(rows):
        destination = args.output / (row['content_hash'] + '.npz')
        with tempfile.TemporaryDirectory() as directory:
            # Training files may be long surveillance videos. Labels apply to the whole sequence.
            sample = decode_file(Path(row['absolute_path']), Path(directory), max_seconds=24 * 3600)
            if len(sample['frames']) != 6:
                raise ValueError(f'Video needs six distinct frames: {row["absolute_path"]}')
            features = []
            for frame in sample['frames']:
                with Image.open(Path(directory) / frame['file']) as image:
                    prediction = classifier.predict(image.convert('RGB'))
                    features.append([prediction['probabilities'][label] for label in FEATURE_LABELS])
            np.savez_compressed(destination, features=np.array(features, dtype=np.float32))
        print(f'Extracted {index + 1}/{len(rows)}', flush=True)
    (args.output / 'provenance.json').write_text(json.dumps({'manifestSha256': manifest_hash,
        'backboneVersion': classifier.version, 'featureLabels': FEATURE_LABELS, 'sampleFrames': 6}, indent=2))


if __name__ == '__main__':
    main()
