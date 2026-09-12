"""YOLOX-Nano COCO evidence. Objects never establish an emergency or its severity."""
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image

URL = 'https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx'
SHA256 = 'c789161ed43c8269fcd4e67c67eeeb4e80c622da2eb296a20bc6007bd18a0b7d'
LABELS = {0: 'person', 1: 'bicycle', 2: 'car', 3: 'motorcycle', 5: 'bus', 7: 'truck'}


class ObjectDetector:
    def __init__(self, directory):
        self.session = None
        self.version = 'YOLOX-Nano-COCO@' + SHA256[:12] + ':adapter-' + hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:12]
        path = Path(directory) / 'yolox_nano.onnx'
        if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == SHA256:
            import onnxruntime as ort
            options = ort.SessionOptions()
            options.intra_op_num_threads = 2
            options.inter_op_num_threads = 1
            self.session = ort.InferenceSession(str(path), options, providers=['CPUExecutionProvider'])

    def status(self):
        return {'status': 'ready' if self.session else 'setup_required', 'modelVersion': self.version,
                'modelId': 'Megvii-BaseDetection/YOLOX-Nano', 'trainedOnRapidResQ': False,
                'explanation': 'COCO person and vehicle detections only. Counts are per frame, not unique people. '
                               'Objects do not prove an accident, violence, fire or urgency.'}

    def predict(self, image):
        if not self.session:
            return {**self.status(), 'detections': []}
        w, h = image.size
        ratio = min(416 / w, 416 / h)
        resized = image.resize((int(w * ratio), int(h * ratio)), Image.Resampling.BILINEAR)
        # Official YOLOX export expects unnormalised BGR pixels, top-left letterboxing.
        pixels = np.full((416, 416, 3), 114, dtype=np.float32)
        pixels[:resized.height, :resized.width] = np.asarray(resized)[:, :, ::-1]
        outputs = self.session.run(None, {self.session.get_inputs()[0].name: pixels.transpose(2, 0, 1)[None]})[0][0]
        return {**self.status(), 'detections': decode_predictions(outputs, ratio, w, h)}


def decode_predictions(outputs, ratio, width, height):
    grids, scales = [], []
    for stride in [8, 16, 32]:
        y, x = np.mgrid[:416 // stride, :416 // stride]
        grids.append(np.stack([x, y], axis=-1).reshape(-1, 2))
        scales.append(np.full((x.size, 1), stride))
    stride = np.concatenate(scales)
    center = (outputs[:, :2] + np.concatenate(grids)) * stride
    size = np.exp(np.clip(outputs[:, 2:4], -20, 20)) * stride
    boxes = np.concatenate([center - size / 2, center + size / 2], axis=1) / ratio
    classes = outputs[:, 5:].argmax(axis=1)
    scores = outputs[:, 4] * outputs[np.arange(len(outputs)), classes + 5]
    order = [int(i) for i in np.argsort(scores)[::-1] if scores[i] >= .35 and int(classes[i]) in LABELS][:300]
    selected = []
    for i in order:
        overlaps = False
        for j in selected:
            if classes[i] != classes[j]:
                continue
            intersection = np.maximum(0, np.minimum(boxes[i, 2:], boxes[j, 2:]) - np.maximum(boxes[i, :2], boxes[j, :2])).prod()
            area_i = np.maximum(0, boxes[i, 2:] - boxes[i, :2]).prod()
            area_j = np.maximum(0, boxes[j, 2:] - boxes[j, :2]).prod()
            if intersection / max(1e-8, area_i + area_j - intersection) > .45:
                overlaps = True
                break
        if not overlaps:
            selected.append(i)
        if len(selected) >= 30:
            break
    return [{'label': LABELS[int(classes[i])], 'confidence': float(scores[i]),
             'box': np.clip(boxes[i] / [width, height, width, height], 0, 1).tolist()}
            for i in selected]
