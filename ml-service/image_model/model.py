"""Six-class MobileNetV3; ImageNet weights alone are never incident predictions."""
import base64
import io
import threading
import time
from pathlib import Path

import torch
from PIL import Image
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights

from schemas import CATEGORIES


def architecture(pretrained=False):
    model = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT if pretrained else None)
    model.classifier[3] = torch.nn.Linear(model.classifier[3].in_features, len(CATEGORIES))
    return model


TRANSFORM = MobileNet_V3_Small_Weights.DEFAULT.transforms()


class ImageClassifier:
    def __init__(self, directory: Path):
        self.model = None
        self.metadata = None
        self.error = None
        self.lock = threading.Lock()
        checkpoint = directory / 'model.pt'
        if checkpoint.exists():
            try:
                bundle = torch.load(checkpoint, map_location='cpu', weights_only=True)
                self.metadata = bundle['metadata']
                if self.metadata.get('trained') is not True or self.metadata.get('classes') != CATEGORIES:
                    raise ValueError('Missing training provenance or incompatible labels')
                model = architecture()
                model.load_state_dict(bundle['state_dict'])
                self.model = model.eval()
            except Exception:
                self.error = 'Model artifact invalid; retrain or restore a compatible checkpoint.'

    def status(self):
        return {'status': 'ready' if self.model is not None else 'training_required',
                'modelVersion': (self.metadata or {}).get('modelVersion'), 'error': self.error}

    def predict(self, image: Image.Image, explain=False):
        if self.model is None:
            return {**self.status(), 'top3': [], 'probabilities': None, 'latencyMs': None}
        start = time.perf_counter()
        tensor = TRANSFORM(image).unsqueeze(0)
        with self.lock:
            with torch.inference_mode():
                probabilities = self.model(tensor).softmax(dim=1)[0].tolist()
            order = sorted(range(len(CATEGORIES)), key=lambda i: probabilities[i], reverse=True)
            overlay = self.gradcam(tensor, order[0]) if explain else None
        return {**self.status(), 'label': CATEGORIES[order[0]], 'confidence': probabilities[order[0]],
                'probabilities': dict(zip(CATEGORIES, probabilities)),
                'top3': [{'label': CATEGORIES[i], 'probability': probabilities[i]} for i in order[:3]],
                'gradCam': overlay, 'latencyMs': (time.perf_counter() - start) * 1000}

    def gradcam(self, tensor, label):
        # Explain the exact center crop seen by the classifier; no off-crop overlay.
        activation = []
        def capture(_module, _inputs, output):
            activation.append(output)
        handle = self.model.features[-1].register_forward_hook(capture)
        try:
            self.model.zero_grad(set_to_none=True)
            logits = self.model(tensor.requires_grad_(True))
            gradients = torch.autograd.grad(logits[0, label], activation[0])[0]
            heat = (gradients.mean((2, 3), keepdim=True) * activation[0]).sum(1).relu()
            heat = torch.nn.functional.interpolate(heat.unsqueeze(1), (224, 224), mode='bilinear', align_corners=False)[0, 0]
            heat = heat / heat.max().clamp(min=1e-8)
            rgb = (tensor[0].detach() * torch.tensor([.229, .224, .225])[:, None, None]
                   + torch.tensor([.485, .456, .406])[:, None, None]).clamp(0, 1)
            tint = torch.stack([heat, torch.zeros_like(heat), 1 - heat])
            overlay = ((.65 * rgb + .35 * tint).detach().permute(1, 2, 0).numpy() * 255).astype('uint8')
            stream = io.BytesIO()
            Image.fromarray(overlay).save(stream, format='PNG')
            return 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode()
        finally:
            handle.remove()
            self.model.zero_grad(set_to_none=True)
