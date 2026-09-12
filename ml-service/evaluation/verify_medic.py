"""Reload saved MEDIC weights, predict held-out images, and record genuine inference latency."""
import csv
import json
import time
from pathlib import Path
import numpy as np
import torch
from PIL import Image
from medic.model import MedicClassifier, LABELS


def main():
    torch.set_num_threads(2)
    root = Path(__file__).resolve().parents[1]
    output = root / 'models/disaster_classifier'
    model = MedicClassifier(output)
    if model.model is None:
        raise RuntimeError('Saved MEDIC model did not load')
    rows = list(csv.DictReader((root / 'datasets/medic/manifest.csv').open(encoding='utf-8')))
    chosen = [next(r for r in rows if r['split'] == 'test' and r['label'] == label) for label in LABELS]
    latencies, predictions = [], []
    for row in chosen:
        with Image.open(row['path']) as image:
            image = image.convert('RGB')
            start = time.perf_counter()
            prediction = model.predict(image)
            latencies.append((time.perf_counter() - start) * 1000)
        assert prediction['status'] == 'ready' and prediction['dataset'] == 'MEDIC'
        assert abs(sum(prediction['probabilities'].values()) - 1) < 1e-5
        assert prediction['confidence'] == max(prediction['probabilities'].values())
        if prediction['lowConfidence']:
            assert prediction['incidentType'] is None
        predictions.append({'actual': row['label'], 'predicted': prediction['predictedLabel'],
                            'incidentType': prediction['incidentType'], 'confidence': prediction['confidence'],
                            'lowConfidence': prediction['lowConfidence'], 'sha256': row['sha256']})
    assert len({round(p['confidence'], 6) for p in predictions}) > 1
    model.threshold = 1.
    with Image.open(chosen[0]['path']) as image:
        rejected = model.predict(image.convert('RGB'))
    assert rejected['lowConfidence'] and rejected['incidentType'] is None
    verification = {'modelVersion': model.metadata['modelVersion'], 'savedModelReloaded': True,
                    'testImagePredictions': predictions, 'thresholdRejectionVerified': True}
    (output / 'verification.json').write_text(json.dumps(verification, indent=2))
    evaluation = json.loads((output / 'evaluation.json').read_text())
    evaluation['latencyMs'] = {'mean': float(np.mean(latencies)), 'p50': float(np.median(latencies)),
        'p95': float(np.percentile(latencies, 95)), 'scope': 'CPU model inference and preprocessing on seven held-out images; includes first inference, excludes network and model loading.'}
    (output / 'evaluation.json').write_text(json.dumps(evaluation, indent=2))
    print(json.dumps(verification, indent=2))


if __name__ == '__main__':
    main()
