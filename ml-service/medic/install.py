"""Install the verified release model without downloading or shipping the MEDIC dataset."""
import hashlib
import json
import os
import shutil
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    source = root / 'artifacts/medic'
    metadata = json.loads((source / 'metadata.json').read_text(encoding='utf-8'))
    if hashlib.sha256((source / 'model.pt').read_bytes()).hexdigest() != metadata['weightsSha256']:
        raise ValueError('Release checkpoint checksum mismatch')
    evaluation = json.loads((source / 'evaluation.json').read_text(encoding='utf-8'))
    if evaluation['modelVersion'] != metadata['modelVersion'] or evaluation['sampleCount'] <= 0:
        raise ValueError('Release has no matching held-out evaluation')
    target = Path(os.environ.get('MODEL_DIR', root / 'models')) / 'disaster_classifier'
    target.mkdir(parents=True, exist_ok=True)
    for name in ['model.pt', 'metadata.json', 'evaluation.json', 'LICENSE.txt']:
        shutil.copyfile(source / name, target / name)
    print('Installed ' + metadata['modelVersion'] + '. No dataset was copied.')


if __name__ == '__main__':
    main()
