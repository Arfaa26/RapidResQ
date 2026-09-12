"""Explicit event-group splits and leakage checks shared by training/evaluation."""
import csv
import hashlib
import re
from pathlib import Path
from schemas import CATEGORIES, PRIORITIES


def digest(value):
    return hashlib.sha256(value).hexdigest()


def read_manifest(path, kind, required_splits=('train', 'val', 'test')):
    path = Path(path).resolve()
    rows = list(csv.DictReader(path.open(encoding='utf-8-sig', newline='')))
    if not rows:
        raise ValueError('No labeled data. Supply a reviewed dataset; templates contain headers only.')
    required = {'split', 'group_id', 'category', 'source', 'license'} | ({'path'} if kind == 'image' else {'title', 'description', 'priority'})
    if not required.issubset(rows[0]):
        raise ValueError(f'Required columns: {sorted(required)}')
    groups, contents, visual_hashes = {}, {}, {}
    for row in rows:
        if row['split'] not in ('train', 'val', 'test') or row['category'] not in CATEGORIES:
            raise ValueError('Invalid split or category')
        if not all(row[k].strip() for k in ['group_id', 'source', 'license']):
            raise ValueError('Event group, source and license are required for every record')
        if kind == 'image':
            file = (path.parent / row['path']).resolve()
            row['absolute_path'] = str(file)
            row['content_hash'] = digest(file.read_bytes())
            from PIL import Image, ImageOps
            import imagehash
            with Image.open(file) as image:
                visual_hash = str(imagehash.phash(ImageOps.exif_transpose(image).convert('RGB')))
            if visual_hash in visual_hashes and visual_hashes[visual_hash] != row['split']:
                raise ValueError('Perceptually identical image appears across splits')
            visual_hashes[visual_hash] = row['split']
        else:
            if row['priority'] not in PRIORITIES:
                raise ValueError('Priority must be LOW/MEDIUM/HIGH/CRITICAL')
            text = f"{row['title']} {row['description']}".strip()
            if not text:
                raise ValueError('Empty text report')
            row['text'] = text
            row['content_hash'] = digest(re.sub(r'\W+', ' ', text.lower()).strip().encode())
        row['group_hash'] = digest(row['group_id'].strip().encode())
        for key, registry in [('group_hash', groups), ('content_hash', contents)]:
            if row[key] in registry and registry[row[key]] != row['split']:
                raise ValueError(f'Data leakage: {key} appears across splits')
            registry[row[key]] = row['split']
    for split in required_splits:
        subset = [r for r in rows if r['split'] == split]
        if set(r['category'] for r in subset) != set(CATEGORIES):
            raise ValueError(f'{split} must include all six categories')
        if kind == 'text' and set(r['priority'] for r in subset) != set(PRIORITIES):
            raise ValueError(f'{split} must include all four priorities')
    return rows, digest(path.read_bytes())


def metadata(rows, manifest_hash, model_version, algorithm):
    from datetime import datetime, timezone
    return {'trained': True, 'modelVersion': model_version, 'algorithm': algorithm,
            'trainedAt': datetime.now(timezone.utc).isoformat(), 'classes': CATEGORIES,
            'manifestSha256': manifest_hash,
            'splitCounts': {s: sum(r['split'] == s for r in rows) for s in ['train', 'val', 'test']},
            'developmentContentHashes': [r['content_hash'] for r in rows if r['split'] != 'test'],
            'developmentGroupHashes': sorted({r['group_hash'] for r in rows if r['split'] != 'test'})}
