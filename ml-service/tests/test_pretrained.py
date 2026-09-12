"""Offline policy/contract tests. Fixtures are not domain accuracy evidence."""
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from analytics import duplicates
from fusion import fuse
from pretrained.models import PretrainedImageClassifier, PretrainedTextClassifier, SemanticMatcher
from schemas import CATEGORIES, DuplicateRequest


def test_missing_snapshots_do_not_download_or_invent_predictions(tmp_path):
    for model in [PretrainedImageClassifier(tmp_path), PretrainedTextClassifier(tmp_path), SemanticMatcher(tmp_path)]:
        assert model.status()['status'] == 'setup_required'
        assert model.status()['trainedOnRapidResQ'] is False
        assert model.status()['calibrated'] is False
    assert PretrainedImageClassifier(tmp_path).predict(None)['probabilities'] is None
    assert PretrainedTextClassifier(tmp_path).predict('A report')['probabilities'] is None
    assert not list(tmp_path.iterdir())


def test_default_api_mode_is_pretrained_but_missing_files_need_setup(tmp_path, monkeypatch):
    import app as module
    monkeypatch.setattr(module, 'MODEL_DIR', tmp_path)
    monkeypatch.delenv('ML_MODEL_MODE', raising=False)
    with TestClient(module.app) as client:
        health = client.get('/health').json()
        assert health['mode'] == 'pretrained'
        assert health['similarity']['status'] == 'setup_required'
        analysis = client.post('/analyze', data={'description': 'Citizen report'}).json()
        assert analysis['confidence'] is None
        assert analysis['status'] == 'setup_required'
        assert all(v['evaluation'] is None for v in client.get('/evaluation').json().values())


def evidence():
    image = {'status': 'ready', 'label': 'FIRE', 'confidence': .9,
             'probabilities': {c: .9 if c == 'FIRE' else .02 for c in CATEGORIES},
             'inferenceMode': 'pretrained_zero_shot'}
    text = {'status': 'ready', 'category': 'FIRE', 'categoryProbabilities': {'FIRE': .9},
            'confidence': .95, 'priority': 'CRITICAL', 'severityScore': .95,
            'inferenceMode': 'pretrained_zero_shot'}
    return image, text


def test_pretrained_agreement_never_removes_authority_review():
    result = fuse(*evidence())
    assert result['needsReview'] is True
    assert result['priority'] == 'CRITICAL'
    assert 'uncalibrated' in result['reasoning']
    assert result['fusion']['isProbability'] is False


def test_unknown_urgency_is_not_low_and_unclear_image_does_not_force_category():
    image, text = evidence()
    image['uncertain'] = True
    text['uncertain'] = True
    text.pop('severityScore')
    text.pop('priority')
    result = fuse(image, text)
    assert result['detectedCategory'] == 'HAZARD'
    assert result['priority'] == 'HIGH'
    assert result['confidence'] is None
    assert result['fusion']['score'] is None


def test_semantic_matching_is_gated_by_distance_time_and_bounded():
    now = datetime.now(timezone.utc).isoformat()
    report = {'id': 'new', 'title': '', 'description': 'Cars collided outside the station',
              'location': {'lat': 19, 'lng': 73}, 'createdAt': now}
    candidates = [{**report, 'id': str(i), 'description': 'Two vehicles crashed near station entrance'} for i in range(25)]
    candidates.append({**report, 'id': 'far', 'location': {'lat': 20, 'lng': 73}})
    class Matcher:
        def status(self): return {'status': 'ready', 'modelVersion': 'test-fixture'}
        def similarities(self, texts):
            assert len(texts) == 21
            return [.9] * (len(texts)-1)
    result = duplicates(DuplicateRequest(report=report, candidates=candidates), Matcher())
    assert result['semanticCandidatesChecked'] == 20
    assert result['semanticCandidatesTruncated'] is True
    assert all(m['textMethod'] == 'minilm' and m['incidentId'] != 'far' for m in result['matches'])


def test_semantic_failure_retains_explicit_lexical_fallback():
    now = datetime.now(timezone.utc).isoformat()
    report = {'id': 'new', 'description': 'The same long incident description',
              'location': {'lat': 19, 'lng': 73}, 'createdAt': now}
    class Broken:
        def status(self): return {'status': 'ready'}
        def similarities(self, texts): raise RuntimeError('test failure')
    result = duplicates(DuplicateRequest(report=report, candidates=[{**report, 'id': 'old'}]), Broken())
    assert result['semanticModel']['status'] == 'unavailable'
    assert result['matches'][0]['textMethod'] == 'tfidf'


def test_long_text_is_rejected_before_silent_truncation(tmp_path):
    model = PretrainedTextClassifier(tmp_path)
    model.model = object()
    class Tokenizer:
        def encode(self, text, **kwargs): return list(range(301))
    model.tokenizer = Tokenizer()
    result = model.predict('long report')
    assert result['status'] == 'input_too_long'
    assert result['probabilities'] is None
