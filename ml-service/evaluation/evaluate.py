import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from image_model.model import ImageClassifier
from text_model.model import TextClassifier
from schemas import CATEGORIES, PRIORITIES
from training.data import read_manifest


def metrics(actual, predicted, labels):
    report = classification_report(actual, predicted, labels=labels, output_dict=True, zero_division=0)
    return {'accuracy': float(accuracy_score(actual, predicted)),
            'precision': report['macro avg']['precision'], 'recall': report['macro avg']['recall'],
            'f1': report['macro avg']['f1-score'], 'averaging': 'macro',
            'labels': labels, 'confusionMatrix': confusion_matrix(actual, predicted, labels=labels).tolist(),
            'perClass': {c: report[c] for c in labels}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--kind', required=True, choices=['image', 'text'])
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--model-dir')
    parser.add_argument('--mode', choices=['trained', 'pretrained'], default='trained')
    args = parser.parse_args()
    directory = Path(args.model_dir or (f'models/pretrained/{args.kind}' if args.mode == 'pretrained' else f'models/{args.kind}'))
    rows, fingerprint = read_manifest(args.manifest, args.kind,
                                      required_splits=('test',) if args.mode == 'pretrained' else ('train', 'val', 'test'))
    test = [r for r in rows if r['split'] == 'test']
    if args.mode == 'pretrained':
        from pretrained.models import PretrainedImageClassifier, PretrainedTextClassifier
        classifier = PretrainedImageClassifier(directory) if args.kind == 'image' else PretrainedTextClassifier(directory)
    else:
        classifier = ImageClassifier(directory) if args.kind == 'image' else TextClassifier(directory)
    if classifier.status()['status'] != 'ready':
        raise ValueError('Model is not ready. Complete setup/training before evaluation; no numbers generated.')
    meta = classifier.metadata if args.kind == 'image' or args.mode == 'pretrained' else classifier.bundle['metadata']
    for row in test:
        if row['content_hash'] in meta.get('developmentContentHashes', []) or row['group_hash'] in meta.get('developmentGroupHashes', []):
            raise ValueError('Test leakage against this trained model')
    predictions, latency = [], []
    for row in test:
        if args.kind == 'image':
            with Image.open(row['absolute_path']) as image:
                result = classifier.predict(ImageOps.exif_transpose(image).convert('RGB'))
        else:
            result = classifier.predict(row['text'])
        if args.mode == 'pretrained':
            key = 'label' if args.kind == 'image' else 'category'
            if result.get('uncertain') or result.get(key) not in CATEGORIES:
                result[key] = 'ABSTAIN'
            if args.kind == 'text' and (result.get('priorityUncertain') or result.get('priority') not in PRIORITIES):
                result['priority'] = 'ABSTAIN'
        predictions.append(result)
        latency.append(result['latencyMs'])
    # Abstentions remain errors in the denominator, never silently dropped.
    scores = {'category': metrics([r['category'] for r in test],
              [p.get('label' if args.kind == 'image' else 'category', 'ABSTAIN') for p in predictions], CATEGORIES + ['ABSTAIN'])}
    if args.kind == 'text':
        scores['priority'] = metrics([r['priority'] for r in test], [p.get('priority', 'ABSTAIN') for p in predictions], PRIORITIES + ['ABSTAIN'])
    # Macro metrics average only the target labels; the extra matrix column records abstentions.
    for name, labels in [('category', CATEGORIES), ('priority', PRIORITIES)]:
        if name not in scores:
            continue
        actual = [r[name] for r in test]
        key = 'label' if args.kind == 'image' else name
        predicted = [p.get(key, 'ABSTAIN') for p in predictions]
        report = classification_report(actual, predicted, labels=labels, output_dict=True, zero_division=0)
        scores[name].update({'precision': report['macro avg']['precision'], 'recall': report['macro avg']['recall'],
                            'f1': report['macro avg']['f1-score'], 'perClass': {c: report[c] for c in labels}})
    output = {'modelVersion': meta['modelVersion'], 'algorithm': meta['algorithm'], 'split': 'test',
              'sampleCount': len(test), 'manifestSha256': fingerprint,
              'evaluatedAt': datetime.now(timezone.utc).isoformat(), 'metrics': scores,
              'latencyMs': {'mean': float(np.mean(latency)), 'p50': float(np.percentile(latency, 50)),
                            'p95': float(np.percentile(latency, 95)), 'scope': 'CPU per sample; preprocessing included; network excluded'},
              'abstentionCount': sum(p['status'] != 'ready' or 'ABSTAIN' in [p.get('label'), p.get('category'), p.get('priority')] for p in predictions),
              'inferenceMode': args.mode,
              'pretrainingOverlap': 'unknown; upstream training data overlap cannot be ruled out' if args.mode == 'pretrained' else 'not assessed for ImageNet backbone'}
    output_directory = directory.parent.parent / 'evaluation-pretrained' / args.kind if args.mode == 'pretrained' else directory
    output_directory.mkdir(parents=True, exist_ok=True)
    (output_directory / 'evaluation.json').write_text(json.dumps(output, indent=2, allow_nan=False), encoding='utf-8')
    print(json.dumps(output, indent=2))


if __name__ == '__main__':
    main()
