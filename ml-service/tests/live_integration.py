"""Opt-in HTTP smoke check against LOCAL demo processes only.

Usage: python tests/live_integration.py --base http://127.0.0.1:5051
Creates synthetic software-test reports in the local in-memory store.
"""
import argparse
import io
import json
from urllib.parse import urlparse
from uuid import uuid4
import httpx
from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', required=True)
    args = parser.parse_args()
    if urlparse(args.base).hostname not in ('127.0.0.1', 'localhost'):
        raise ValueError('This smoke check only accepts localhost')
    client = httpx.Client(base_url=args.base, timeout=30, trust_env=False)
    health = client.get('/api/health').json()
    if health.get('storage') != 'local-demo':
        raise ValueError('Refusing to submit test reports to persistent storage')
    image = Image.new('RGB', (128, 128), 'white')
    image.paste('black', (0, 0, 64, 64))
    out = io.BytesIO(); image.save(out, format='PNG')
    files = {'media': ('integration-fixture.png', out.getvalue(), 'image/png')}
    suffix = uuid4().hex[:8]
    form = {'title': f'Integration fixture {suffix}', 'description': 'Synthetic test of report receipt and duplicate grouping',
            'categoryHint': 'CIVIC', 'lat': '19.042', 'lng': '73.062', 'address': 'Synthetic local test coordinates',
            'reporterName': 'Software test', 'reporterPhone': 'TEST'}
    preview = client.post('/api/ai/preview', data=form, files=files)
    preview.raise_for_status()
    analysis = preview.json()['aiAnalysis']
    assert analysis['image']['status'] == 'training_required'
    assert analysis['confidence'] is None
    created = client.post('/api/incidents', data=form, files=files)
    created.raise_for_status()
    first = created.json()['incident']
    created = client.post('/api/incidents', data=form, files=files)
    created.raise_for_status()
    second = created.json()['incident']
    # Other smoke runs may leave same visual fixture: identify its suggested primary.
    assert second['duplicate']['status'] == 'POSSIBLE'
    target = second['duplicate']['of']
    original_count = client.get(f'/api/incidents/{target}').json()['incident']['reportCount']
    confirmed = client.patch(f"/api/incidents/{second['id']}/duplicate", json={'decision': 'CONFIRM'})
    confirmed.raise_for_status()
    assert client.get(f'/api/incidents/{target}').json()['incident']['reportCount'] == original_count + 1
    assert client.patch(f"/api/incidents/{second['id']}/duplicate", json={'decision': 'CONFIRM'}).status_code == 409
    update = client.patch(f'/api/incidents/{target}/status', files={'status': (None, 'ACKNOWLEDGED'), 'note': (None, 'Synthetic integration verification')})
    update.raise_for_status()
    assert client.get(f"/api/incidents/{second['id']}").json()['incident']['status'] == 'ACKNOWLEDGED'
    assert client.get(second['mediaUrl']).status_code == 200
    evaluation = client.get('/api/ml/evaluation'); evaluation.raise_for_status()
    assert all(r['evaluation'] is None for r in evaluation.json()['models'].values())
    hotspot = client.get('/api/analytics/hotspots?days=7'); hotspot.raise_for_status()
    assert hotspot.json()['analytics']['forecast'] is False
    print(json.dumps({'result': 'passed', 'checks': ['Node to FastAPI image upload', 'no fabricated confidence',
          'incident persistence', 'possible duplicate', 'authority confirmation', 'idempotent review',
          'grouped citizen status', 'media retained', 'honest evaluation state', 'hotspot API'],
          'createdReportIds': [first['id'], second['id']]}))


if __name__ == '__main__':
    main()
