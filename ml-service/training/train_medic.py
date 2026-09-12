"""Actual MEDIC transfer learning with a frozen MobileNet backbone and trained softmax head."""
import argparse
import copy
import csv
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter

import numpy as np
import torch
from PIL import Image
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from torch.utils.data import Dataset, DataLoader
from medic.model import DisasterNetwork, LABELS, TRANSFORM


class Images(Dataset):
    def __init__(self, rows):
        self.rows = rows

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        with Image.open(self.rows[i]['path']) as image:
            return TRANSFORM(image.convert('RGB'))


def train(root, output, epochs=60, batch_size=64, workers=2):
    started = time.time()
    torch.manual_seed(42)
    torch.set_num_threads(4)
    manifest = root / 'manifest.csv'
    rows = list(csv.DictReader(manifest.open(encoding='utf-8')))
    if not rows:
        raise ValueError('Run MEDIC preprocessing before training')
    manifest_hash = hashlib.sha256(manifest.read_bytes()).hexdigest()
    config = json.loads((root / 'config.json').read_text())
    if config['labels'] != LABELS:
        raise ValueError('Label configuration mismatch')
    seen = {}
    for row in rows:
        if row['label'] not in LABELS or row['split'] not in ('train', 'val', 'test'):
            raise ValueError('Invalid manifest label/split')
        for key in ('sha256', 'phash'):
            token = key + ':' + row[key]
            if token in seen:
                raise ValueError('Duplicate or leakage in cleaned manifest')
            seen[token] = row['split']
    indices = {s: torch.tensor([i for i, r in enumerate(rows) if r['split'] == s]) for s in ['train', 'val', 'test']}
    for split in indices:
        if {rows[i]['label'] for i in indices[split].tolist()} != set(LABELS):
            raise ValueError(f'{split} lacks one or more classes')
    model = DisasterNetwork(pretrained=True).eval()
    for parameter in model.features.parameters():
        parameter.requires_grad_(False)
    cache = root / ('features-' + manifest_hash[:16] + '.npy')
    if cache.exists():
        features = np.load(cache, allow_pickle=False)
        if features.shape != (len(rows), 576) or not np.isfinite(features).all():
            raise ValueError('Invalid feature cache')
    else:
        features = np.empty((len(rows), 576), dtype=np.float32)
        loader = DataLoader(Images(rows), batch_size=batch_size, num_workers=workers, shuffle=False)
        offset = 0
        with torch.inference_mode():
            for batch in loader:
                features[offset:offset + len(batch)] = model.embeddings(batch).numpy()
                offset += len(batch)
                if offset % (batch_size * 20) == 0 or offset == len(rows):
                    print(f'MEDIC embeddings {offset}/{len(rows)}; elapsed {time.time()-started:.0f}s', flush=True)
        np.save(cache, features, allow_pickle=False)
    x = torch.from_numpy(features)
    y = torch.tensor([LABELS.index(r['label']) for r in rows])
    model.mean.copy_(x[indices['train']].mean(0))
    model.scale.copy_(x[indices['train']].std(0).clamp(min=.05))
    with torch.no_grad():
        model.classifier.weight.zero_()
        model.classifier.bias.zero_()
    x = (x - model.mean) / model.scale
    counts = torch.bincount(y[indices['train']], minlength=len(LABELS)).float()
    criterion = torch.nn.CrossEntropyLoss(weight=counts.sum() / (len(LABELS) * counts))
    optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=.003, weight_decay=.01)
    best, best_state, stale, history = -1., None, 0, []
    for epoch in range(epochs):
        model.classifier.train()
        order = indices['train'][torch.randperm(len(indices['train']))]
        for batch in order.split(512):
            loss = criterion(model.classifier(x[batch]), y[batch])
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
        model.classifier.eval()
        with torch.inference_mode():
            logits = model.classifier(x[indices['val']])
            score = float(f1_score(y[indices['val']], logits.argmax(1), average='macro', zero_division=0))
        history.append({'epoch': epoch + 1, 'validationMacroF1': score})
        print(f'MEDIC epoch {epoch+1}: validation macro F1 {score:.4f}', flush=True)
        if score > best:
            best, best_state, stale = score, copy.deepcopy(model.classifier.state_dict()), 0
        else:
            stale += 1
        if stale >= 10:
            break
    model.classifier.load_state_dict(best_state)
    # Fit temperature on validation only; never use test labels for model/threshold selection.
    with torch.no_grad():
        val_logits = model.classifier(x[indices['val']]).detach()
    log_temperature = torch.zeros(1, requires_grad=True)
    optimizer = torch.optim.LBFGS([log_temperature], lr=.1, max_iter=80)
    def closure():
        optimizer.zero_grad()
        loss = torch.nn.functional.cross_entropy(val_logits / log_temperature.exp().clamp(.05, 20), y[indices['val']])
        loss.backward()
        return loss
    optimizer.step(closure)
    model.temperature.copy_(log_temperature.detach().exp().clamp(.05, 20))
    model.eval()
    with torch.inference_mode():
        scores = (model.classifier(x[indices['test']]) / model.temperature).softmax(1).numpy()
    truth = y[indices['test']].numpy()
    predicted = scores.argmax(1)
    confidence = scores.max(1)
    accepted = confidence >= config['confidenceThreshold']
    output.mkdir(parents=True, exist_ok=True)
    checkpoint = output / 'model.pt'
    torch.save(model.state_dict(), checkpoint)
    weights_hash = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    version = 'medic-mobilenetv3-' + weights_hash[:12]
    metadata = {'dataset': 'MEDIC', 'modelVersion': version, 'trained': True, 'labels': LABELS,
        'architecture': 'Frozen ImageNet MobileNetV3-Small + MEDIC-trained 576-to-7 linear softmax head',
        'backboneWeights': 'MobileNet_V3_Small_Weights.IMAGENET1K_V1', 'weightsSha256': weights_hash,
        'datasetRevision': config['revision'], 'manifestSha256': manifest_hash, 'license': config['license'],
        'source': config['source'], 'threshold': config['confidenceThreshold'], 'seed': 42,
        'temperature': float(model.temperature.item()), 'trainingHistory': history,
        'splitCounts': {s: dict(Counter(r['label'] for r in rows if r['split'] == s)) for s in indices},
        'preprocessing': 'EXIF transpose, RGB, max-side 512 storage; ImageNet resize256/center224/normalization',
        'elapsedSeconds': round(time.time() - started, 1)}
    evaluation = {'modelVersion': version, 'dataset': 'MEDIC', 'evaluatedAt': datetime.now(timezone.utc).isoformat(), 'split': 'test', 'sampleCount': len(truth),
        'manifestSha256': manifest_hash, 'accuracy': float(accuracy_score(truth, predicted)),
        'macroF1': float(f1_score(truth, predicted, average='macro', zero_division=0)),
        'perClass': classification_report(truth, predicted, labels=list(range(7)), target_names=LABELS, output_dict=True, zero_division=0),
        'confusionMatrix': confusion_matrix(truth, predicted, labels=list(range(7))).tolist(),
        'labels': LABELS, 'threshold': config['confidenceThreshold'], 'coverage': float(accepted.mean()),
        'acceptedAccuracy': float(accuracy_score(truth[accepted], predicted[accepted])) if accepted.any() else None,
        'lowConfidenceCount': int((~accepted).sum()), 'validationMacroF1': best,
        'limitations': 'Cleaned official image split; not unseen-event, citizen-upload or emergency severity validation.'}
    (output / 'metadata.json').write_text(json.dumps(metadata, indent=2))
    (output / 'evaluation.json').write_text(json.dumps(evaluation, indent=2))
    print(json.dumps(evaluation, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', type=Path, default=Path('datasets/medic'))
    parser.add_argument('--output', type=Path, default=Path('models/disaster_classifier'))
    parser.add_argument('--epochs', type=int, default=60)
    parser.add_argument('--batch-size', type=int, default=64)
    parser.add_argument('--workers', type=int, default=2)
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1 or args.workers < 0:
        parser.error('Invalid training parameters')
    train(args.dataset, args.output, args.epochs, args.batch_size, args.workers)
