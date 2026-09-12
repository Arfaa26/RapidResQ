"""Video-level labels and group splits; never copy weak labels onto every frame."""
import csv
import hashlib
from pathlib import Path
from video.temporal import EVENT_LABELS


def read_videos(manifest):
    manifest = Path(manifest).resolve()
    with manifest.open(encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.DictReader(stream))
    if not rows:
        raise ValueError('No labeled videos. Add permitted footage and reviewed event labels.')
    required = {'path', 'event', 'split', 'group_id', 'source', 'license'}
    if not required <= rows[0].keys():
        raise ValueError('Required video columns: ' + ', '.join(sorted(required)))
    groups, contents = {}, {}
    for row in rows:
        if row['event'] not in EVENT_LABELS or row['split'] not in ('train', 'val', 'test'):
            raise ValueError('Invalid event or split')
        if any(not row[k].strip() for k in required):
            raise ValueError('Every video needs a group, source and permission/license record')
        path = (manifest.parent / row['path']).resolve()
        with path.open('rb') as file:
            digest = hashlib.file_digest(file, 'sha256').hexdigest()
        row.update(absolute_path=str(path), content_hash=digest)
        for value, registry in [(row['group_id'], groups), (digest, contents)]:
            if value in registry:
                if registry[value] != row['split']:
                    raise ValueError('Data leakage: related or identical videos cross splits')
                if registry is contents:
                    raise ValueError('Duplicate video in manifest')
            registry[value] = row['split']
    classes = {r['event'] for r in rows}
    if 'NORMAL' not in classes or len(classes) < 2:
        raise ValueError('Include NORMAL and at least one incident class')
    for split in ('train', 'val', 'test'):
        if {r['event'] for r in rows if r['split'] == split} != classes:
            raise ValueError(f'{split} must contain every represented class; missing classes are not invented')
    return rows, hashlib.sha256(manifest.read_bytes()).hexdigest()
