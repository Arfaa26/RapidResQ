"""Download the official QCRI mirror at a pinned revision; raw files stay local."""
import json
from pathlib import Path
from huggingface_hub import snapshot_download


def main():
    root = Path(__file__).resolve().parents[1] / 'datasets' / 'medic'
    config = json.loads((root / 'config.json').read_text())
    print('MEDIC: non-commercial research, CC-BY-NC-SA-4.0. Source: ' + config['source'], flush=True)
    snapshot_download(repo_id=config['repository'], repo_type='dataset', revision=config['revision'],
                      local_dir=root / 'raw', max_workers=2,
                      allow_patterns=['data/*.parquet', 'README.md', '*legalcode.txt'])
    (root / 'download.json').write_text(json.dumps(config, indent=2))
    print('MEDIC download completed.', flush=True)


if __name__ == '__main__':
    main()
