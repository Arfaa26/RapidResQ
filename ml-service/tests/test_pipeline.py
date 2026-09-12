import csv
import io
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from analytics import duplicates, hotspots
from app import app
from fusion import fuse
from schemas import CATEGORIES, PRIORITIES, DuplicateRequest, HotspotRequest
from training.data import read_manifest


@pytest.fixture
def client(tmp_path, monkeypatch):
    import app as module
    monkeypatch.setattr(module, 'MODEL_DIR', tmp_path)
    monkeypatch.setenv('ML_MODEL_MODE', 'trained')
    with TestClient(app) as client:
        yield client


def test_untrained_model_never_returns_confidence_or_metrics(client):
    for hint in CATEGORIES:
        result = client.post('/analyze', data={'description': 'Report submitted for review', 'categoryHint': hint}).json()
        assert result['confidence'] is None
        assert result['text']['status'] == 'training_required'
        assert result['source'] == 'manual_review'
        assert result['priority'] == 'HIGH'
    evaluation = client.get('/evaluation').json()
    assert all(x['evaluation'] is None for x in evaluation.values())


def test_corrupt_image_video_and_empty_text_are_explicit(client):
    result = client.post('/analyze', files={'media': ('bad.jpg', b'not an image', 'image/jpeg')}).json()
    assert result['image']['status'] == 'invalid_image'
    assert result['text']['status'] == 'not_provided'
    assert result['confidence'] is None
    video = client.post('/analyze', files={'media': ('video.mp4', b'video fixture', 'video/mp4')}).json()
    assert video['image']['status'] == 'unsupported_media'


def test_image_hash_and_untrained_top3(client):
    image = Image.new('RGB', (32, 32), 'white')
    image.paste('black', (0, 0, 16, 16))
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    result = client.post('/analyze', files={'media': ('test.png', stream.getvalue(), 'image/png')}).json()
    assert result['image']['status'] == 'training_required'
    assert result['image']['top3'] == []
    assert len(result['imageHash']) == 16


def test_upload_limit_validation_and_service_auth(client, monkeypatch):
    assert client.post('/analyze', data={'context': '[]'}).status_code == 422
    assert client.post('/analyze', files={'media': ('large.jpg', b'x'*(4*1024*1024+1), 'image/jpeg')}).status_code == 413
    monkeypatch.setenv('ML_SERVICE_KEY', 'test-only-key')
    assert client.get('/health').status_code == 401
    assert client.get('/health', headers={'X-ML-Service-Key': 'test-only-key'}).status_code == 200


def report(id='one', **changes):
    return {'id': id, 'title': 'Broken water pipe outside school', 'description': 'Water pouring onto the footpath from a broken pipe',
            'category': 'CIVIC', 'createdAt': datetime.now(timezone.utc).isoformat(),
            'location': {'lat': 19.04, 'lng': 73.06, 'accuracyMeters': 20}, **changes}


def test_duplicate_time_distance_and_similarity_gates():
    original = report()
    close = report('close')
    far = report('far', location={'lat': 20., 'lng': 73.06})
    old = report('old', createdAt=(datetime.now(timezone.utc)-timedelta(hours=3)).isoformat())
    different = report('different', title='Vehicle collision', description='Two cars collided with an injured passenger')
    result = duplicates(DuplicateRequest(report=original, candidates=[close, far, old, different]))
    assert [m['incidentId'] for m in result['matches']] == ['close']
    assert result['matches'][0]['textSimilarity'] == pytest.approx(1)


def test_image_hash_can_match_but_never_bypasses_distance():
    original = report(imageHash='aa55aa55aa55aa55')
    candidate = report('two', imageHash='aa55aa55aa55aa54', title='Another title', description='Different words here')
    result = duplicates(DuplicateRequest(report=original, candidates=[candidate]))
    assert result['matches'][0]['imageHashDistance'] == 1
    candidate['location'] = {'lat': 0, 'lng': 0}
    assert duplicates(DuplicateRequest(report=original, candidates=[candidate]))['matches'] == []


def test_dbscan_uses_meters_and_time_window_and_noise():
    now = datetime.now(timezone.utc)
    incidents = [report(str(i), location={'lat': 19.04 + i*.0001, 'lng': 73.06}) for i in range(3)]
    incidents += [report('far', location={'lat': 20, 'lng': 74}), report('old', createdAt=(now-timedelta(days=40)).isoformat())]
    result = hotspots(HotspotRequest(incidents=incidents), now=now+timedelta(seconds=1))
    assert result['incidentCount'] == 4
    assert result['noiseCount'] == 1
    assert result['hotspots'][0]['count'] == 3
    assert sum(t['count'] for t in result['trends']) == 4
    assert result['forecast'] is False
    assert hotspots(HotspotRequest(incidents=[]))['hotspots'] == []


def predictions():
    # Contract fixtures only; these are never model artifacts or evaluation data.
    image = {'status': 'ready', 'label': 'FIRE', 'confidence': .9,
             'probabilities': {c: .9 if c == 'FIRE' else .02 for c in CATEGORIES}}
    text = {'status': 'ready', 'priority': 'HIGH', 'confidence': .8, 'severityScore': .75,
            'category': 'FIRE', 'categoryProbabilities': {'FIRE': .9}, 'features': []}
    return image, text


def test_fusion_context_is_explicit_and_image_only_does_not_invent_severity():
    image, text = predictions()
    base = fuse(image, text)
    contextual = fuse(image, text, context={'populatedArea': True, 'source': 'reviewed test zone'})
    assert contextual['fusion']['score'] == pytest.approx(base['fusion']['score']+.1)
    assert fuse(image, text, context={'populatedArea': True})['fusion']['score'] == base['fusion']['score']
    assert base['fusion']['isProbability'] is False
    image_only = fuse(image, {'status': 'not_provided'})
    assert image_only['priority'] == 'HIGH'
    assert image_only['fusion']['score'] is None
    text['priority'] = 'CRITICAL'
    assert fuse(image, text)['priority'] == 'CRITICAL'
    text['category'] = 'CIVIC'
    assert fuse(image, text)['needsReview'] is True


def test_dataset_leakage_and_empty_templates_are_rejected(tmp_path):
    path = tmp_path/'text.csv'
    columns = ['title', 'description', 'category', 'priority', 'split', 'group_id', 'source', 'license']
    with path.open('w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
    with pytest.raises(ValueError, match='No labeled data'):
        read_manifest(path, 'text')
    with path.open('a', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        for split in ['train', 'test']:
            writer.writerow(dict(title='Same report', description='Repeated evidence', category='FIRE', priority='HIGH', split=split, group_id='same-event', source='test fixture', license='test only'))
    with pytest.raises(ValueError, match='Data leakage'):
        read_manifest(path, 'text')


def test_stale_evaluation_is_not_shown(client, tmp_path, monkeypatch):
    import app as module
    (tmp_path/'image').mkdir()
    (tmp_path/'image'/'evaluation.json').write_text('{"modelVersion":"stale","split":"test","sampleCount":100}')
    monkeypatch.setattr(module.app.state.image, 'status', lambda: {'status': 'ready', 'modelVersion': 'current'})
    assert client.get('/evaluation').json()['image']['evaluation'] is None
