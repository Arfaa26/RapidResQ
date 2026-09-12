"""Package only tracked ML source for a free Gradio Space; only approved MEDIC model artifacts; no raw datasets or secrets."""
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
        if relative.parts[:2] == ('artifacts', 'medic') and relative.name in ('model.pt', 'metadata.json', 'evaluation.json', 'LICENSE.txt'):
            files['models/disaster_classifier/' + relative.name] = (root / relative).read_bytes()
            continue
        if relative.parts[0] == 'artifacts':
            continue
        if relative.parts[0] in excluded or relative.suffix not in ('.py', '.json'):
            continue
        if relative.name == 'serve.py':
            continue
        files[relative.as_posix()] = (root / relative).read_bytes()
    files['detector/LICENSE.txt'] = (root / 'detector/LICENSE.txt').read_bytes()
    files['THIRD_PARTY_NOTICES.md'] = (root / 'THIRD_PARTY_NOTICES.md').read_bytes()
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
