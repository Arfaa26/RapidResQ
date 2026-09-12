"""Validate and deduplicate official splits, preserving holdout precedence and labels."""
import csv
import hashlib
import io
import json
import warnings
from collections import Counter
from pathlib import Path
import imagehash
import pyarrow.parquet as pq
from PIL import Image, ImageOps
from concurrent.futures import ThreadPoolExecutor
LABELS = ['earthquake', 'flood', 'hurricane', 'fire', 'landslide', 'not_disaster', 'other_disaster']


def prepare_item(item):
    index = item['disaster_types']
    if not isinstance(index, int) or not 0 <= index < len(LABELS):
        return {'error': 'missing_disaster_label'}
    raw = item['image']['bytes']
    digest = hashlib.sha256(raw).hexdigest()
    try:
        with Image.open(io.BytesIO(raw)) as image:
            image.load()
            image = ImageOps.exif_transpose(image).convert('RGB')
            if min(image.size) < 32:
                raise ValueError('Tiny image')
            phash = str(imagehash.phash(image))
            image.thumbnail((512, 512), Image.Resampling.LANCZOS)
            stream = io.BytesIO()
            image.save(stream, format='JPEG', quality=95)
            return {'item': item, 'digest': digest, 'phash': phash, 'jpeg': stream.getvalue()}
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        return {'error': 'corrupt_oversized_or_tiny'}


def prepare(root):
    config = json.loads((root / 'config.json').read_text())
    if config['labels'] != LABELS:
        raise ValueError('MEDIC label order mismatch')
    output = root / 'processed'
    output.mkdir(parents=True, exist_ok=True)
    Image.MAX_IMAGE_PIXELS = 20_000_000
    warnings.simplefilter('error', Image.DecompressionBombWarning)
    seen_bytes, seen_visual, rows, rejected = {}, {}, [], Counter()
    conflicts = set()
    # Retain official test, then validation, then train when duplicate content crosses splits.
    for source_split, split in [('test', 'test'), ('dev', 'val'), ('train', 'train')]:
        files = sorted((root / 'raw/data').glob(source_split + '-*.parquet'))
        if not files:
            raise ValueError(f'Missing official {source_split} shards; finish download first')
        for file in files:
            parquet = pq.ParquetFile(file)
            schema_meta = json.loads(parquet.schema_arrow.metadata[b'huggingface'])
            actual_labels = schema_meta['info']['features']['disaster_types']['names']
            if actual_labels != LABELS:
                raise ValueError('Official parquet labels differ from configured labels')
            with ThreadPoolExecutor(max_workers=6) as pool:
                for batch in parquet.iter_batches(batch_size=64):
                    for prepared in pool.map(prepare_item, batch.to_pylist()):
                        if 'error' in prepared:
                            rejected[prepared['error']] += 1
                            continue
                        item, digest, phash = prepared['item'], prepared['digest'], prepared['phash']
                        index = item['disaster_types']
                        previous = seen_bytes.get(digest) or seen_visual.get(phash)
                        if previous:
                            rejected['duplicate_exact_or_phash'] += 1
                            if previous['label'] != LABELS[index]:
                                conflicts.add(previous['sha256'])
                                rejected['conflicting_duplicate_label'] += 1
                            continue
                        destination = output / (digest + '.jpg')
                        if not destination.exists():
                            destination.write_bytes(prepared['jpeg'])
                        row = {'path': str(destination.resolve()), 'label': LABELS[index], 'split': split, 'sha256': digest,
                               'phash': phash, 'source_path': item['image_path'], 'event_name': item['event_name']}
                        seen_bytes[digest] = row
                        seen_visual[phash] = row
                        rows.append(row)
            print(f'Validated {file.name}: {len(rows)} retained so far', flush=True)
    rows = [r for r in rows if r['sha256'] not in conflicts]
    counts = {split: dict(Counter(r['label'] for r in rows if r['split'] == split)) for split in ['train', 'val', 'test']}
    if any(set(counts[s]) != set(LABELS) for s in counts):
        raise ValueError('A cleaned split is missing a class; inspect the data before training')
    with (root / 'manifest.csv').open('w', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    audit = {'dataset': 'MEDIC', 'revision': config['revision'], 'counts': counts, 'excluded': dict(rejected),
             'conflictingRetainedRowsRemoved': len(conflicts), 'rows': len(rows),
             'splitPolicy': 'Official train/dev/test, with exact SHA-256 and identical perceptual-hash deduplication; test > val > train.',
             'limitations': 'Near-duplicates with different pHashes may remain. Official splits are not an unseen-disaster-event benchmark.'}
    (root / 'preprocessing.json').write_text(json.dumps(audit, indent=2))
    print(json.dumps(audit, indent=2), flush=True)


if __name__ == '__main__':
    prepare(Path(__file__).resolve().parents[1] / 'datasets/medic')
