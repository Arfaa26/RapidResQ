import pytest
from PIL import Image
from medic.model import MedicClassifier, as_visual_prediction, LABELS
from fusion import fuse


def test_missing_medic_artifact_never_claims_prediction(tmp_path):
    prediction = MedicClassifier(tmp_path).predict(Image.new('RGB', (64, 64)))
    assert prediction['status'] == 'training_required'
    assert prediction['confidence'] is None
    assert prediction['incidentType'] is None


def test_threshold_is_configurable_and_validated(tmp_path, monkeypatch):
    monkeypatch.setenv('MEDIC_CONFIDENCE_THRESHOLD', '.85')
    assert MedicClassifier(tmp_path).threshold == .85
    monkeypatch.setenv('MEDIC_CONFIDENCE_THRESHOLD', '2')
    with pytest.raises(ValueError, match='THRESHOLD'):
        MedicClassifier(tmp_path)


def test_uncertain_medic_mapping_does_not_force_disaster_or_severity():
    prediction = {'status': 'ready', 'modelVersion': 'test-fixture', 'confidence': .4,
                  'routingCategory': 'FIRE', 'predictedLabel': 'fire', 'lowConfidence': True,
                  'probabilities': {k: .4 if k == 'fire' else .1 for k in LABELS},
                  'message': 'Low confidence — Manual verification required.'}
    visual = as_visual_prediction(prediction)
    result = fuse(visual, {'status': 'not_provided'})
    assert visual['uncertain'] is True
    assert sum(visual['probabilities'].values()) == pytest.approx(1)
    assert result['confidence'] is None and result['detectedCategory'] == 'HAZARD'
    assert result['fusion']['score'] is None


def test_normal_is_not_proof_that_no_emergency_exists():
    prediction = {'status': 'ready', 'modelVersion': 'test-fixture', 'confidence': .9,
                  'routingCategory': 'HAZARD', 'predictedLabel': 'not_disaster', 'lowConfidence': False,
                  'probabilities': {k: .9 if k == 'not_disaster' else .1 / 6 for k in LABELS},
                  'message': 'No disaster suggested; other emergencies are still possible.'}
    assert as_visual_prediction(prediction)['uncertain'] is True


def test_medic_predict_frames_handles_empty_or_uninitialized(tmp_path):
    classifier = MedicClassifier(tmp_path)
    res = classifier.predict_frames([])
    assert res['status'] == 'training_required'
    assert res['incidentType'] is None
    res2 = classifier.predict_frames([Image.new('RGB', (64, 64))])
    assert res2['status'] == 'training_required'
