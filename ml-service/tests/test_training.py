"""Exercise training and held-out evaluation using isolated synthetic test data.

Artifacts and metrics stay in pytest temporary directories and are never served.
"""
import csv
import json
import sys
import numpy as np
from PIL import Image
from schemas import CATEGORIES, PRIORITIES
from training import train_text, train_image
from evaluation import evaluate
from image_model.model import architecture


def test_text_training_and_evaluation_artifact(tmp_path, monkeypatch):
    path = tmp_path/'text.csv'
    with path.open('w', newline='', encoding='utf-8') as f:
        fields = ['title', 'description', 'category', 'priority', 'split', 'group_id', 'source', 'license']
        writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader()
        for split in ['train', 'val', 'test']:
            for c in CATEGORIES:
                for p in PRIORITIES:
                    writer.writerow({'title': f'{c} {p}', 'description': f'{split} fixture {c} report with {p} severity',
                                     'category': c, 'priority': p, 'split': split, 'group_id': f'{split}-{c}-{p}',
                                     'source': 'Synthetic software test only', 'license': 'Test fixture'})
    output = tmp_path/'model'
    monkeypatch.setattr(sys, 'argv', ['train', '--manifest', str(path), '--output', str(output)])
    train_text.main()
    monkeypatch.setattr(sys, 'argv', ['evaluate', '--kind', 'text', '--manifest', str(path), '--model-dir', str(output)])
    evaluate.main()
    result = json.loads((output/'evaluation.json').read_text())
    assert result['sampleCount'] == 24
    assert result['split'] == 'test'
    assert sum(sum(row) for row in result['metrics']['priority']['confusionMatrix']) == 24
    assert result['latencyMs']['mean'] > 0


def test_image_training_and_evaluation_artifact(tmp_path, monkeypatch):
    rng = np.random.default_rng(42)
    path = tmp_path/'images.csv'
    with path.open('w', newline='', encoding='utf-8') as f:
        fields = ['path', 'category', 'split', 'group_id', 'source', 'license']
        writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader()
        for split in ['train', 'val', 'test']:
            for c in CATEGORIES:
                name = f'{split}-{c}.png'
                Image.fromarray(rng.integers(0, 256, (224, 224, 3), dtype=np.uint8)).save(tmp_path/name)
                writer.writerow({'path': name, 'category': c, 'split': split, 'group_id': f'{split}-{c}',
                                 'source': 'Synthetic software test only', 'license': 'Test fixture'})
    # Keep this test offline. Production training still uses pretrained ImageNet weights.
    monkeypatch.setattr(train_image, 'architecture', lambda pretrained: architecture(pretrained=False))
    output = tmp_path/'model'
    monkeypatch.setattr(sys, 'argv', ['train', '--manifest', str(path), '--output', str(output), '--epochs', '1'])
    train_image.main()
    monkeypatch.setattr(sys, 'argv', ['evaluate', '--kind', 'image', '--manifest', str(path), '--model-dir', str(output)])
    evaluate.main()
    result = json.loads((output/'evaluation.json').read_text())
    assert result['sampleCount'] == 6
    assert result['modelVersion'].startswith('mobilenetv3-')
    assert sum(sum(row) for row in result['metrics']['category']['confusionMatrix']) == 6
