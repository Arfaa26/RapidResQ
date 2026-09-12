"""Install the official, SHA-256 pinned YOLOX export during setup only."""
import hashlib
import os
from pathlib import Path
import httpx
from detector.model import URL, SHA256


def main():
    root = Path(os.environ.get('MODEL_DIR', Path(__file__).resolve().parents[1] / 'models')) / 'detector'
    root.mkdir(parents=True, exist_ok=True)
    path = root / 'yolox_nano.onnx'
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == SHA256:
        return
    response = httpx.get(URL, follow_redirects=True, timeout=120)
    response.raise_for_status()
    if hashlib.sha256(response.content).hexdigest() != SHA256:
        raise ValueError('YOLOX download checksum mismatch')
    temporary = path.with_suffix('.tmp')
    temporary.write_bytes(response.content)
    temporary.replace(path)


if __name__ == '__main__':
    main()
