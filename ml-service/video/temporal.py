"""Optional supervised sequence head. Never initialise random weights for serving."""
import hashlib
import json
from pathlib import Path

import numpy as np
import torch
from torch import nn

FEATURE_LABELS = ['FIRE', 'ACCIDENT', 'FLOOD', 'MEDICAL', 'CRIME', 'CIVIC', 'HAZARD']
EVENT_LABELS = ['NORMAL', 'FIRE', 'ACCIDENT', 'EXPLOSION', 'VIOLENCE', 'FLOOD', 'MEDICAL', 'OTHER']


class SequenceHead(nn.Module):
    def __init__(self, classes):
        super().__init__()
        self.sequence = nn.GRU(len(FEATURE_LABELS), 32, batch_first=True)
        self.event = nn.Linear(32, classes)
        self.anomaly = nn.Linear(32, 1)

    def forward(self, features):
        _, hidden = self.sequence(features)
        return self.event(hidden[-1]), self.anomaly(hidden[-1]).squeeze(-1)


class TemporalClassifier:
    def __init__(self, directory, backbone_version):
        self.model = None
        self.metadata = {}
        root = Path(directory)
        self.reason = 'A video event model needs labeled training data and held-out evaluation.'
        if not (root / 'metadata.json').exists():
            return
        try:
            metadata = json.loads((root / 'metadata.json').read_text())
            weights = root / 'weights.pt'
            evaluation = json.loads((root / 'evaluation.json').read_text())
            assert metadata['backboneVersion'] == backbone_version
            assert metadata['featureLabels'] == FEATURE_LABELS
            assert metadata['sampleFrames'] == 6
            assert set(metadata['classes']) <= set(EVENT_LABELS) and 'NORMAL' in metadata['classes']
            assert evaluation['modelVersion'] == metadata['modelVersion'] and evaluation['split'] == 'test'
            assert evaluation['sampleCount'] > 0 and evaluation['manifestSha256'] == metadata['manifestSha256']
            assert hashlib.sha256(weights.read_bytes()).hexdigest() == metadata['weightsSha256']
            model = SequenceHead(len(metadata['classes']))
            model.load_state_dict(torch.load(weights, map_location='cpu', weights_only=True))
            self.model = model.eval()
            self.metadata = metadata
        except (OSError, ValueError, KeyError, AssertionError, RuntimeError):
            self.reason = 'Video artifacts are incomplete, incompatible or missing matching test evaluation.'

    def status(self):
        return {'status': 'ready' if self.model else 'training_required',
                'modelVersion': self.metadata.get('modelVersion'), 'explanation': self.reason if not self.model else
                'Experimental GRU over scene scores, trained with video-level labels. No severity or audio model.',
                'trainedOnRapidResQ': self.metadata.get('trainedOnRapidResQ', False)}

    def predict(self, predictions):
        if not self.model:
            return self.status()
        features = np.array([[p['probabilities'][c] for c in FEATURE_LABELS] for p in predictions], dtype=np.float32)
        if features.shape != (6, 7):
            return {**self.status(), 'status': 'insufficient_frames'}
        with torch.inference_mode():
            events, anomaly = self.model(torch.from_numpy(features)[None])
            scores = events.softmax(-1)[0].tolist()
            anomaly_score = anomaly.sigmoid().item()
        order = np.argsort(scores)[::-1]
        return {**self.status(), 'label': self.metadata['classes'][int(order[0])],
                'scores': dict(zip(self.metadata['classes'], scores)), 'anomalyScore': anomaly_score,
                'uncertain': scores[order[0]] < .6 or scores[order[0]] - scores[order[1]] < .15,
                'calibrated': False, 'authorityReviewRequired': True}
