"""Train event + anomaly GRU heads; select on validation, report untouched test metrics."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import numpy as np
import torch
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix, roc_auc_score
from training.video_data import read_videos
from video.temporal import FEATURE_LABELS, SequenceHead


def train(manifest, features_dir, output, epochs=100):
    torch.manual_seed(42)
    torch.set_num_threads(2)
    rows, manifest_hash = read_videos(manifest)
    provenance = json.loads((features_dir / 'provenance.json').read_text())
    if provenance['manifestSha256'] != manifest_hash or provenance['featureLabels'] != FEATURE_LABELS or provenance['sampleFrames'] != 6:
        raise ValueError('Feature provenance mismatch; re-extract this manifest')
    classes = sorted({r['event'] for r in rows})
    samples = []
    for row in rows:
        with np.load(features_dir / (row['content_hash'] + '.npz'), allow_pickle=False) as archive:
            value = archive['features']
        if value.shape != (6, 7) or not np.isfinite(value).all() or (value < 0).any() or (value > 1).any():
            raise ValueError('Invalid features')
        samples.append(value)
    x = torch.tensor(np.array(samples), dtype=torch.float32)
    y = torch.tensor([classes.index(r['event']) for r in rows])
    a = torch.tensor([r['event'] != 'NORMAL' for r in rows], dtype=torch.float32)
    indices = {split: torch.tensor([i for i, r in enumerate(rows) if r['split'] == split]) for split in ['train', 'val', 'test']}
    model = SequenceHead(len(classes))
    optimizer = torch.optim.AdamW(model.parameters(), lr=.002, weight_decay=.01)
    counts = torch.bincount(y[indices['train']], minlength=len(classes)).float()
    criterion = torch.nn.CrossEntropyLoss(weight=counts.sum() / (len(classes) * counts))
    best, best_state, stale = -1., None, 0
    for _ in range(epochs):
        model.train()
        order = indices['train'][torch.randperm(len(indices['train']))]
        for batch in order.split(32):
            logits, anomaly = model(x[batch])
            loss = criterion(logits, y[batch]) + torch.nn.functional.binary_cross_entropy_with_logits(anomaly, a[batch])
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.)
            optimizer.step()
        model.eval()
        with torch.inference_mode():
            logits, _ = model(x[indices['val']])
            score = f1_score(y[indices['val']], logits.argmax(-1), average='macro', zero_division=0)
        if score > best:
            best, best_state, stale = score, copy.deepcopy(model.state_dict()), 0
        else:
            stale += 1
        if stale >= 15:
            break
    model.load_state_dict(best_state)
    model.eval()
    with torch.inference_mode():
        logits, anomaly = model(x[indices['test']])
        predicted, truth = logits.argmax(-1).numpy(), y[indices['test']].numpy()
        anomaly_scores = anomaly.sigmoid().numpy()
    output.mkdir(parents=True, exist_ok=True)
    weights = output / 'weights.pt'
    torch.save(model.state_dict(), weights)
    weights_hash = hashlib.sha256(weights.read_bytes()).hexdigest()
    version = 'rapidresq-video-gru-' + weights_hash[:12]
    metadata = {**provenance, 'modelVersion': version, 'classes': classes, 'weightsSha256': weights_hash,
                'trainedOnRapidResQ': False, 'sources': sorted({r['source'] for r in rows}),
                'splitCounts': {s: len(i) for s, i in indices.items()}, 'weakVideoLabels': True}
    evaluation = {'modelVersion': version, 'manifestSha256': manifest_hash, 'split': 'test',
        'sampleCount': len(truth), 'scope': 'video-level only; no temporal localization or urgency accuracy',
        'classes': classes, 'accuracy': accuracy_score(truth, predicted),
        'macroF1': f1_score(truth, predicted, average='macro', zero_division=0),
        'confusionMatrix': confusion_matrix(truth, predicted, labels=list(range(len(classes)))).tolist(),
        'anomalyRocAuc': roc_auc_score(a[indices['test']].numpy(), anomaly_scores), 'validationMacroF1': best}
    (output / 'metadata.json').write_text(json.dumps(metadata, indent=2))
    (output / 'evaluation.json').write_text(json.dumps(evaluation, indent=2))
    print(json.dumps(evaluation, indent=2))
    return evaluation


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--features', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('models/video'))
    parser.add_argument('--epochs', type=int, default=100)
    args = parser.parse_args()
    if args.epochs < 1:
        parser.error('epochs must be positive')
    train(args.manifest, args.features, args.output, args.epochs)
