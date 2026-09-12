"""Explicit, resumable setup. Serving never contacts Hugging Face."""
import argparse
import json
import os
from pathlib import Path

os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
from huggingface_hub import snapshot_download

LOCK = json.loads(Path(__file__).with_name('models.lock.json').read_text())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-dir', default=str(Path(__file__).resolve().parents[1] / 'models'))
    args = parser.parse_args()
    root = Path(args.model_dir) / 'pretrained'
    for kind, spec in LOCK.items():
        print(f"Downloading {kind}: {spec['repo']} @ {spec['revision']}", flush=True)
        directory = root / kind
        snapshot_download(repo_id=spec['repo'], revision=spec['revision'], local_dir=directory,
                          cache_dir=root / '.cache', max_workers=2,
                          allow_patterns=['*.json', '*.txt', '*.model', '*.safetensors', 'README.md', 'LICENSE*'],
                          ignore_patterns=['onnx/*', 'openvino/*'])
        # Written only after the complete pinned snapshot succeeds.
        (directory / 'rapidresq-snapshot.json').write_text(json.dumps(spec, indent=2), encoding='utf-8')
    print('All three pretrained snapshots are installed. Restart the ML service.', flush=True)


if __name__ == '__main__':
    main()
