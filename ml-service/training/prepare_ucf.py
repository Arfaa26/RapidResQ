"""Import locally downloaded UCF-Crime with its official video-level split lists."""
import argparse
import csv
import hashlib
import re
from pathlib import Path

# Arrest footage is not evidence of a crime; exclude it from automatic mapping.
MAPPING = {'Arson': 'FIRE', 'RoadAccidents': 'ACCIDENT', 'Explosion': 'EXPLOSION',
           'Abuse': 'VIOLENCE', 'Assault': 'VIOLENCE', 'Fighting': 'VIOLENCE', 'Shooting': 'VIOLENCE',
           'Burglary': 'OTHER', 'Robbery': 'OTHER', 'Stealing': 'OTHER', 'Shoplifting': 'OTHER',
           'Vandalism': 'OTHER', 'Normal': 'NORMAL', 'Normal_Videos': 'NORMAL', 'Normal_Videos_event': 'NORMAL'}


def entries(path):
    return {Path(line.strip().split()[0].replace('\\', '/')).stem for line in Path(path).read_text().splitlines() if line.strip()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--train-list', required=True)
    parser.add_argument('--test-list', required=True)
    parser.add_argument('--permission', required=True, help='Actual dataset permission/license reference, not a guessed license')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    train, test = entries(args.train_list), entries(args.test_list)
    if train & test:
        raise ValueError('Official split lists overlap')
    rows, excluded = [], 0
    for path in sorted(args.root.rglob('*')):
        if path.suffix.lower() not in ('.mp4', '.avi', '.mov', '.webm'):
            continue
        name = path.stem
        if name not in train | test:
            continue
        prefix = re.split(r'\d', name)[0].rstrip('_')
        event = MAPPING.get(prefix)
        if event is None:
            excluded += 1
            continue
        # Keep all derivatives of a source event together; official test split stays untouched.
        group = re.sub(r'_x\d+$', '', name)
        split = 'test' if name in test else ('val' if int(hashlib.sha256(group.encode()).hexdigest()[:8], 16) % 5 == 0 else 'train')
        rows.append(dict(path=str(path.resolve()), event=event, split=split, group_id='ucf:' + group,
                         source='UCF-Crime official video-level annotations', license=args.permission))
    if not rows:
        raise ValueError('No matching UCF videos; download the dataset and its official lists first')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('w', encoding='utf-8', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=['path', 'event', 'split', 'group_id', 'source', 'license'])
        writer.writeheader()
        writer.writerows(rows)
    print(f'Imported {len(rows)} video labels; excluded {excluded} unmapped videos. Review groups and class balance before extraction.')


if __name__ == '__main__':
    main()
