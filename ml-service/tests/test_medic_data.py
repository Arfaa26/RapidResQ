"""Synthetic data-cleaning checks; not training or dataset accuracy evidence."""
import csv
import io
import json
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
from PIL import Image
from training.prepare_medic import prepare, LABELS


def test_official_splits_keep_test_and_remove_duplicate_and_corrupt_training_images(tmp_path):
    root = tmp_path / 'medic'
    (root / 'raw/data').mkdir(parents=True)
    (root / 'config.json').write_text(json.dumps({'labels': LABELS, 'revision': 'synthetic-fixture'}))
    test_copy = None
    for offset, split in enumerate(['test', 'dev', 'train']):
        rows = []
        for label in range(7):
            image = Image.fromarray(np.random.default_rng(offset * 10 + label).integers(0, 256, (64, 64, 3), dtype=np.uint8))
            buffer = io.BytesIO()
            image.save(buffer, format='PNG')
            rows.append({'disaster_types': label, 'image': {'bytes': buffer.getvalue()},
                         'image_path': f'{split}-{label}.png', 'event_name': f'fixture-{split}-{label}'})
        if split == 'test':
            test_copy = rows[0].copy()
        if split == 'train':
            rows.extend([test_copy, {**rows[0], 'image': {'bytes': b'corrupt'}}])
        table = pa.Table.from_pylist(rows)
        metadata = {'info': {'features': {'disaster_types': {'names': LABELS}}}}
        table = table.replace_schema_metadata({b'huggingface': json.dumps(metadata).encode()})
        pq.write_table(table, root / 'raw/data' / f'{split}-fixture.parquet')
    prepare(root)
    audit = json.loads((root / 'preprocessing.json').read_text())
    assert audit['rows'] == 21
    assert audit['excluded']['duplicate_exact_or_phash'] == 1
    assert audit['excluded']['corrupt_oversized_or_tiny'] == 1
    rows = list(csv.DictReader((root / 'manifest.csv').open()))
    assert len({r['sha256'] for r in rows}) == 21
    assert [r['split'] for r in rows if r['source_path'] == 'test-0.png'] == ['test']
