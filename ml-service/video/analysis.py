"""Sampled scene evidence, explicitly separate from a trained temporal classifier."""
import hashlib
from pathlib import Path


def analyze_frames(sample, classifier, temporal=None):
    predictions = [(timestamp, classifier.predict(image)) for timestamp, image in sample['frames']]
    ready = [(timestamp, result) for timestamp, result in predictions if result['status'] == 'ready']
    details = {'status': 'ready' if len(ready) == len(predictions) else 'partial',
               'method': 'sampled_frames', 'durationSeconds': sample['durationSeconds'],
               'sampledFrameCount': len(predictions), 'analyzedFrameCount': len(ready),
               'audioAnalyzed': False, 'temporalModel': 'training_required',
               'frames': [{'timestampSeconds': t, 'status': p['status'], 'label': p.get('label'),
                           'confidence': p.get('confidence'), 'uncertain': p.get('uncertain', True)}
                          for t, p in predictions],
               'explanation': 'Up to 6 sampled frames are analyzed. Brief events between frames may be missed. '
                              'This is scene analysis, not motion, audio or trained anomaly recognition.'}
    if not ready:
        return {'status': predictions[0][1]['status'], 'top3': [], 'probabilities': None}, details
    labels = list(ready[0][1]['probabilities'])
    scores = {label: sum(p['probabilities'][label] for _, p in ready) / len(ready) for label in labels}
    order = sorted(scores, key=scores.get, reverse=True)
    disagreement = len({p['label'] for _, p in ready}) > 1
    uncertain = (disagreement or len(ready) != len(predictions) or any(p.get('uncertain', False) for _, p in ready)
                 or scores[order[0]] < .6 or scores[order[0]] - scores[order[1]] < .15)
    digest = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:12]
    aggregate = {**ready[0][1], 'modelVersion': ready[0][1]['modelVersion'] + ':video-' + digest,
                 'label': order[0], 'confidence': scores[order[0]], 'probabilities': scores,
                 'top3': [{'label': label, 'probability': scores[label]} for label in order[:3]],
                 'uncertain': uncertain, 'gradCam': None, 'explanationStatus': 'not_requested',
                 'explanation': 'Mean scene-match scores across sampled video frames. Mixed or unclear frames require review.'}
    aggregate.pop('matchScores', None)
    if temporal:
        details['eventModel'] = temporal.predict([p for _, p in ready])
        details['temporalModel'] = details['eventModel']['status']
    details['disagreement'] = disagreement
    details['uncertain'] = uncertain
    return aggregate, details
