"""MEDIC transfer-learning classifier. Serving only loads verified trained artifacts."""
import hashlib
import json
import os
import threading
from pathlib import Path

import torch
from torch import nn
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights

LABELS = ['earthquake', 'flood', 'hurricane', 'fire', 'landslide', 'not_disaster', 'other_disaster']
DISPLAY = ['Earthquake', 'Flood', 'Storm/Hurricane', 'Fire', 'Landslide', 'Normal', 'Other Emergency']
ROUTING = ['HAZARD', 'FLOOD', 'HAZARD', 'FIRE', 'HAZARD', 'HAZARD', 'HAZARD']
TRANSFORM = MobileNet_V3_Small_Weights.IMAGENET1K_V1.transforms()


class DisasterNetwork(nn.Module):
    def __init__(self, pretrained=False):
        super().__init__()
        backbone = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.IMAGENET1K_V1 if pretrained else None)
        self.features = backbone.features
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.register_buffer('mean', torch.zeros(576))
        self.register_buffer('scale', torch.ones(576))
        self.register_buffer('temperature', torch.ones(1))
        self.classifier = nn.Linear(576, len(LABELS))

    def embeddings(self, images):
        return self.pool(self.features(images)).flatten(1)

    def forward(self, images):
        features = (self.embeddings(images) - self.mean) / self.scale
        return self.classifier(features) / self.temperature.clamp(min=.05)


class MedicClassifier:
    def __init__(self, directory):
        self.model, self.metadata, self.error = None, {}, None
        self.lock = threading.Lock()
        self.threshold = float(os.environ.get('MEDIC_CONFIDENCE_THRESHOLD', '.70'))
        if not 0 < self.threshold <= 1:
            raise ValueError('MEDIC_CONFIDENCE_THRESHOLD must be greater than zero and at most one')
        root = Path(directory)
        if not (root / 'metadata.json').exists():
            return
        try:
            metadata = json.loads((root / 'metadata.json').read_text())
            evaluation = json.loads((root / 'evaluation.json').read_text())
            checkpoint = root / 'model.pt'
            if (metadata.get('dataset') != 'MEDIC' or metadata.get('trained') is not True or metadata.get('labels') != LABELS
                or hashlib.sha256(checkpoint.read_bytes()).hexdigest() != metadata['weightsSha256']
                or evaluation.get('modelVersion') != metadata['modelVersion'] or evaluation.get('split') != 'test'
                or evaluation.get('sampleCount', 0) <= 0):
                raise ValueError('Incomplete or incompatible MEDIC artifacts')
            model = DisasterNetwork()
            model.load_state_dict(torch.load(checkpoint, map_location='cpu', weights_only=True))
            self.model, self.metadata = model.eval(), metadata
        except (ValueError, OSError, RuntimeError, KeyError):
            self.error = 'MEDIC artifacts could not be verified. Restore the matching model, metadata and evaluation.'

    def status(self):
        return {'status': 'ready' if self.model is not None else 'training_required', 'dataset': 'MEDIC',
                'model': 'RapidResQ Disaster Classifier', 'modelVersion': self.metadata.get('modelVersion'),
                'architecture': 'MobileNetV3-Small frozen ImageNet features + trained linear classifier',
                'threshold': self.threshold, 'error': self.error}

    def predict(self, image):
        if self.model is None:
            return {**self.status(), 'incidentType': None, 'confidence': None, 'needsReview': True}
        with self.lock, torch.inference_mode():
            tensor = TRANSFORM(image.convert('RGB')).unsqueeze(0).to(next(self.model.parameters()).device)
            scores = self.model(tensor).softmax(1)[0].cpu().tolist()
        winner = max(range(len(scores)), key=scores.__getitem__)
        confidence = scores[winner]
        low = confidence < self.threshold
        normal = LABELS[winner] == 'not_disaster'
        return {**self.status(), 'incidentType': None if low else DISPLAY[winner], 'predictedLabel': LABELS[winner],
                'candidateType': DISPLAY[winner], 'confidence': confidence, 'lowConfidence': low,
                'probabilities': dict(zip(LABELS, scores)), 'needsReview': True, 'calibration': 'validation_temperature_scaling',
                'routingCategory': ROUTING[winner],
                'message': 'Low confidence — Manual verification required.' if low else
                'No disaster is suggested by this image. This does not rule out a medical, crime or other emergency.' if normal else
                'Disaster category suggested by the MEDIC-trained model. Authority verification required.'}


def as_visual_prediction(prediction):
    """Preserve existing category storage; keep exact MEDIC subtype separately in aiAnalysis.disaster."""
    if prediction['status'] != 'ready':
        return {'status': prediction['status'], 'top3': [], 'probabilities': None}
    probabilities = {c: 0. for c in ['FIRE', 'ACCIDENT', 'FLOOD', 'MEDICAL', 'CRIME', 'CIVIC', 'HAZARD']}
    for label, route in zip(LABELS, ROUTING):
        probabilities[route] += prediction['probabilities'][label]
    order = sorted(probabilities, key=probabilities.get, reverse=True)
    return {'status': 'ready', 'modelVersion': prediction['modelVersion'], 'dataset': 'MEDIC',
            'label': prediction['routingCategory'], 'confidence': prediction['confidence'],
            'probabilities': probabilities, 'top3': [{'label': k, 'probability': probabilities[k]} for k in order[:3]],
            'uncertain': prediction['lowConfidence'] or prediction['predictedLabel'] == 'not_disaster',
            'scoreType': 'model_probability', 'trainedOnRapidResQ': False, 'trainedOnDataset': 'MEDIC',
            'explanation': prediction['message'], 'gradCam': None, 'explanationStatus': 'not_requested'}
