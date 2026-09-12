import time
from pathlib import Path
import joblib
import numpy as np
from schemas import CATEGORIES, PRIORITIES


class TextClassifier:
    def __init__(self, directory: Path):
        self.bundle = None
        self.error = None
        path = directory / 'model.joblib'
        if path.exists():
            try:
                # Load only locally trained/trusted artifacts. Joblib is executable serialization.
                bundle = joblib.load(path)
                if bundle['metadata'].get('trained') is not True:
                    raise ValueError('Missing training provenance')
                if set(bundle['priority'].classes_) != set(PRIORITIES) or set(bundle['category'].classes_) != set(CATEGORIES):
                    raise ValueError('Incompatible labels')
                self.bundle = bundle
            except Exception:
                self.error = 'Model artifact invalid; retrain with the pinned environment.'

    def status(self):
        return {'status': 'ready' if self.bundle else 'training_required',
                'modelVersion': self.bundle['metadata']['modelVersion'] if self.bundle else None, 'error': self.error}

    def predict(self, text):
        if not text.strip():
            return {'status': 'not_provided', 'probabilities': None, 'latencyMs': None}
        if self.bundle is None:
            return {**self.status(), 'probabilities': None, 'latencyMs': None}
        start = time.perf_counter()
        vectorizer = self.bundle['vectorizer']
        vector = vectorizer.transform([text])
        if vector.nnz == 0:
            return {'status': 'out_of_vocabulary', 'probabilities': None, 'latencyMs': (time.perf_counter()-start)*1000}
        classifier = self.bundle['priority']
        probabilities = classifier.predict_proba(vector)[0]
        by_label = dict(zip(classifier.classes_, map(float, probabilities)))
        index = int(np.argmax(probabilities))
        contributions = vector.toarray()[0] * classifier.coef_[index]
        features = vectorizer.get_feature_names_out()
        order = np.argsort(np.abs(contributions))[::-1]
        explanations = [{'feature': str(features[i]), 'contribution': float(contributions[i])}
                        for i in order[:8] if contributions[i] != 0]
        category_model = self.bundle['category']
        category_probs = dict(zip(category_model.classes_, map(float, category_model.predict_proba(vector)[0])))
        return {**self.status(), 'priority': str(classifier.classes_[index]),
                'confidence': float(probabilities[index]), 'probabilities': by_label,
                'severityScore': sum(by_label[label] * i / 3 for i, label in enumerate(PRIORITIES)),
                'category': max(category_probs, key=category_probs.get), 'categoryProbabilities': category_probs,
                'features': explanations, 'latencyMs': (time.perf_counter() - start) * 1000}
