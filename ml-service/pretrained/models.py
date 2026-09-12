"""Real local inference. Relative candidate scores are not calibrated incident risk."""
import hashlib
import json
import logging
import os
import threading
import time
from functools import lru_cache
from pathlib import Path

import numpy as np
import torch

os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
os.environ.setdefault('USE_TF', '0')
os.environ.setdefault('USE_FLAX', '0')
LOCK = json.loads(Path(__file__).with_name('models.lock.json').read_text())
IMAGE_LABELS = {
    'FIRE': 'an uncontrolled fire with flames or smoke in a building or outdoors',
    'ACCIDENT': 'a traffic collision with crashed or damaged vehicles',
    'FLOOD': 'floodwater covering a street, houses, or land',
    'MEDICAL': 'a person receiving emergency medical assistance',
    'CRIME': 'a visible violent assault or a robbery in progress',
    'CIVIC': 'a pothole, broken road, overflowing garbage, or damaged public infrastructure',
    'HAZARD': 'an ordinary scene, document, object, or unclear image with no visible incident',
}
TEXT_LABELS = {
    'FIRE': 'an uncontrolled fire or smoke incident',
    'ACCIDENT': 'a traffic collision or vehicle accident',
    'FLOOD': 'flooding or dangerous water accumulation',
    'MEDICAL': 'a person needing medical assistance',
    'CRIME': 'a reported crime, assault, robbery, or threat',
    'CIVIC': 'a civic maintenance problem such as a pothole, garbage, or damaged infrastructure',
    'HAZARD': 'an unclear incident or a matter outside these incident categories',
}
PRIORITY_LABELS = {
    'LOW': 'a routine maintenance issue with no immediate danger to people',
    'MEDIUM': 'a problem needing timely attention but no reported serious injury or immediate threat to life',
    'HIGH': 'an urgent incident with significant danger or injury requiring a rapid response',
    'CRITICAL': 'an immediate threat to life, such as someone unconscious, not breathing, trapped in fire, or facing ongoing lethal violence',
    'UNSPECIFIED': 'a report with insufficient information to determine urgency',
}


class LocalModel:
    def __init__(self, directory, kind):
        self.directory = Path(directory)
        self.kind = kind
        self.spec = LOCK[kind]
        self.model = None
        self.error = None
        self.lock = threading.Lock()
        # Bind evaluation to weights, prompts and inference code, not only the upstream name.
        digest = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()[:12]
        self.version = f"{self.spec['repo']}@{self.spec['revision'][:12]}:adapter-{digest}"
        self.metadata = {'modelVersion': self.version, 'algorithm': self.spec['repo'],
                         'trainedOnRapidResQ': False, 'inferenceMode': 'pretrained_zero_shot'}

    def load(self, loader):
        marker = self.directory / 'rapidresq-snapshot.json'
        if not marker.exists():
            self.error = 'Run python -m pretrained.download to install the pinned models, then restart.'
            return
        try:
            if json.loads(marker.read_text()) != self.spec:
                raise ValueError('Snapshot provenance mismatch')
            loader()
            self.model.eval()
        except Exception:
            self.model = None
            self.error = 'Pretrained snapshot could not load. Check the service log and reinstall the pinned snapshot.'
            logging.exception('Could not load %s model', self.kind)

    def status(self):
        return {'status': 'ready' if self.model is not None else 'setup_required',
                'modelVersion': self.version, 'modelId': self.spec['repo'], 'revision': self.spec['revision'],
                'inferenceMode': 'pretrained_embeddings' if self.kind == 'similarity' else 'pretrained_zero_shot',
                'trainedOnRapidResQ': False, 'domainEvaluation': 'evaluation_required',
                'scoreType': 'cosine_similarity' if self.kind == 'similarity' else 'relative_candidate_score',
                'calibrated': False, 'error': self.error}


class PretrainedImageClassifier(LocalModel):
    def __init__(self, directory):
        super().__init__(directory, 'image')
        self.labels = list(IMAGE_LABELS)
        self.load(self._load)

    def _load(self):
        from transformers import AutoModel, AutoProcessor
        self.processor = AutoProcessor.from_pretrained(self.directory, local_files_only=True, trust_remote_code=False, use_fast=False)
        self.model = AutoModel.from_pretrained(self.directory, local_files_only=True,
                                             trust_remote_code=False, use_safetensors=True)
        self.model.eval()
        prompts = [f'This is a photo of {value}.' for value in IMAGE_LABELS.values()]
        inputs = self.processor(text=prompts, padding='max_length', max_length=64, truncation=True, return_tensors='pt')
        with torch.inference_mode():
            features = self.model.get_text_features(**inputs)
            self.text_features = torch.nn.functional.normalize(features, dim=-1)

    def predict(self, image, explain=False):
        if self.model is None:
            return {**self.status(), 'top3': [], 'probabilities': None, 'latencyMs': None}
        start = time.perf_counter()
        with self.lock, torch.inference_mode():
            inputs = self.processor(images=image, return_tensors='pt').to(self.model.device)
            features = torch.nn.functional.normalize(self.model.get_image_features(**inputs), dim=-1)
            logits = (features @ self.text_features.T) * self.model.logit_scale.exp() + self.model.logit_bias
            scores = logits.softmax(dim=-1)[0].tolist()
            matches = logits.sigmoid()[0].tolist()
        order = np.argsort(scores)[::-1].tolist()
        uncertain = (scores[order[0]] < .60 or scores[order[0]] - scores[order[1]] < .15
                     or matches[order[0]] < .10 or self.labels[order[0]] == 'HAZARD')
        return {**self.status(), 'label': self.labels[order[0]], 'confidence': scores[order[0]],
                'probabilities': dict(zip(self.labels, scores)), 'matchScores': dict(zip(self.labels, matches)),
                'top3': [{'label': self.labels[i], 'probability': scores[i]} for i in order[:3]],
                'uncertain': uncertain, 'gradCam': None,
                'explanation': 'Scores compare fixed scene descriptions, including an unclear/no-incident option. They are not verified incident probabilities.',
                'explanationStatus': 'not_supported' if explain else 'not_requested',
                'latencyMs': (time.perf_counter() - start) * 1000}


class PretrainedTextClassifier(LocalModel):
    def __init__(self, directory):
        super().__init__(directory, 'text')
        self.load(self._load)

    def _load(self):
        from transformers import AutoTokenizer, AutoModelForSequenceClassification
        self.tokenizer = AutoTokenizer.from_pretrained(self.directory, local_files_only=True, trust_remote_code=False)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.directory, local_files_only=True, trust_remote_code=False, use_safetensors=True)
        entailment = [int(i) for i, label in self.model.config.id2label.items() if label.lower() == 'entailment']
        if len(entailment) != 1:
            raise ValueError('Cannot identify entailment logit')
        self.entailment = entailment[0]

    @lru_cache(maxsize=128)
    def _scores(self, text):
        labels = list(TEXT_LABELS.values()) + list(PRIORITY_LABELS.values())
        hypotheses = [f'This report describes {label}.' for label in labels]
        values = []
        with self.lock, torch.inference_mode():
            for start in range(0, len(hypotheses), 4):
                group = hypotheses[start:start + 4]
                tokens = self.tokenizer([text] * len(group), group, padding=True, truncation='only_first',
                                        max_length=384, return_tensors='pt')
                tokens = tokens.to(self.model.device)
                values.append(self.model(**tokens).logits[:, self.entailment])
        logits = torch.cat(values)
        return logits[:len(TEXT_LABELS)].softmax(0).tolist(), logits[len(TEXT_LABELS):].softmax(0).tolist()

    def predict(self, text):
        if not text.strip():
            return {'status': 'not_provided', 'probabilities': None, 'latencyMs': None}
        if self.model is None:
            return {**self.status(), 'probabilities': None, 'latencyMs': None}
        start = time.perf_counter()
        # Never silently discard the end of a report, where critical details may occur.
        if len(self.tokenizer.encode(text, add_special_tokens=False)) > 300:
            return {**self.status(), 'status': 'input_too_long', 'probabilities': None,
                    'explanation': 'Please shorten the English report to 300 model tokens (roughly 200 words); no urgency was inferred.',
                    'latencyMs': (time.perf_counter() - start) * 1000}
        category_scores, priority_scores = self._scores(text.strip())
        categories = dict(zip(TEXT_LABELS, category_scores))
        priorities = dict(zip(PRIORITY_LABELS, priority_scores))
        category = max(categories, key=categories.get)
        priority = max(priorities, key=priorities.get)
        sorted_category = sorted(category_scores, reverse=True)
        uncertain = category == 'HAZARD' or sorted_category[0] < .60 or sorted_category[0] - sorted_category[1] < .15
        priority_uncertain = priority == 'UNSPECIFIED' or priorities[priority] < .60
        result = {**self.status(), 'category': category, 'categoryProbabilities': categories,
                  'confidence': priorities[priority], 'probabilities': priorities, 'features': [],
                  'uncertain': uncertain, 'priorityUncertain': priority_uncertain, 'language': 'English',
                  'hypotheses': [{'label': k, 'description': v, 'score': priorities[k]} for k, v in PRIORITY_LABELS.items()],
                  'explanation': 'English zero-shot inference against documented urgency descriptions. No token attribution or emergency calibration is claimed.',
                  'latencyMs': (time.perf_counter() - start) * 1000}
        if priority != 'UNSPECIFIED':
            result['priority'] = priority
        if not priority_uncertain:
            # Conditional ordinal score; uncertainty is retained separately, not treated as LOW.
            known_mass = 1 - priorities['UNSPECIFIED']
            result['severityScore'] = sum(priorities[k] * i / 3 for i, k in enumerate(list(PRIORITY_LABELS)[:4])) / known_mass
        return result


class SemanticMatcher(LocalModel):
    def __init__(self, directory):
        super().__init__(directory, 'similarity')
        self.load(self._load)

    def _load(self):
        from transformers import AutoTokenizer, AutoModel
        self.tokenizer = AutoTokenizer.from_pretrained(self.directory, local_files_only=True, trust_remote_code=False)
        self.model = AutoModel.from_pretrained(self.directory, local_files_only=True, trust_remote_code=False, use_safetensors=True)

    def similarities(self, texts):
        if self.model is None:
            return None
        # Chunk rather than silently truncating reports to MiniLM's 128-token training window.
        chunks, owners = [], []
        for i, text in enumerate(texts):
            ids = self.tokenizer.encode(text, add_special_tokens=False)
            for start in range(0, max(1, len(ids)), 120):
                chunks.append(self.tokenizer.decode(ids[start:start + 120], skip_special_tokens=True))
                owners.append(i)
        embeddings = []
        with self.lock, torch.inference_mode():
            for start in range(0, len(chunks), 16):
                tokens = self.tokenizer(chunks[start:start + 16], padding=True, return_tensors='pt')
                tokens = tokens.to(self.model.device)
                hidden = self.model(**tokens).last_hidden_state
                mask = tokens['attention_mask'].unsqueeze(-1).to(hidden.dtype)
                embeddings.extend(((hidden * mask).sum(1) / mask.sum(1).clamp(min=1)).unbind())
            pooled = torch.stack([torch.stack([e for e, owner in zip(embeddings, owners) if owner == i]).mean(0)
                                  for i in range(len(texts))])
            pooled = torch.nn.functional.normalize(pooled, dim=-1)
            return (pooled[0] @ pooled[1:].T).clamp(-1, 1).tolist()
