"""Package only tracked ML source for a free Gradio Space; no weights or secrets."""
import argparse
import subprocess
import zipfile
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    repo = root.parent
    tracked = subprocess.check_output(['git', 'ls-files', '--', 'ml-service'], cwd=repo, text=True).splitlines()
    excluded = {'tests', 'datasets', 'models', 'deploy', 'training', 'evaluation'}
    files = {}
    for item in tracked:
        relative = Path(item).relative_to('ml-service')
        if relative.parts[0] in excluded or relative.suffix not in ('.py', '.json'):
            continue
        if relative.name == 'serve.py':
            continue
        files[relative.as_posix()] = (root / relative).read_bytes()
    files['README.md'] = (root / 'deploy/SPACE_FREE_README.md').read_bytes()
    requirements = (root / 'requirements.txt').read_text().replace('pytest==8.4.2', 'spaces==0.51.3')
    files['requirements.txt'] = requirements.encode()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(files.items()):
            archive.writestr(name, content)
    print(f'Packaged {len(files)} source files; weights download on Space startup.')


if __name__ == '__main__':
    main()
