"""Synthetic fixtures check computation only; no demo model/accuracy is shipped."""
import numpy as np
import joblib
import torch
from PIL import Image
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from image_model.model import ImageClassifier, architecture
from text_model.model import TextClassifier
from schemas import CATEGORIES, PRIORITIES


def test_image_checkpoint_softmax_and_gradcam(tmp_path):
    torch.manual_seed(3)
    model = architecture()
    # One optimization step exercises checkpoint roundtrip; not incident-model training.
    model.eval()
    optimizer = torch.optim.SGD(model.classifier.parameters(), lr=.01)
    loss = torch.nn.functional.cross_entropy(model(torch.zeros(1, 3, 224, 224)), torch.tensor([0]))
    loss.backward(); optimizer.step()
    torch.save({'state_dict': model.state_dict(), 'metadata': {'trained': True, 'classes': CATEGORIES,
               'modelVersion': 'synthetic-unit-fixture'}}, tmp_path/'model.pt')
    classifier = ImageClassifier(tmp_path)
    result = classifier.predict(Image.new('RGB', (224, 224), 'white'), explain=True)
    assert len(result['top3']) == 3
    assert abs(sum(result['probabilities'].values()) - 1) < 1e-5
    assert result['confidence'] == result['top3'][0]['probability']
    assert result['gradCam'].startswith('data:image/png;base64,')
    assert result['latencyMs'] > 0
    assert len(classifier.model.features[-1]._forward_hooks) == 0


def test_text_probabilities_are_from_fitted_estimators(tmp_path):
    texts = [f'{c.lower()} report {p.lower()} level' for c in CATEGORIES for p in PRIORITIES]
    vectorizer = TfidfVectorizer(ngram_range=(1, 2))
    vectors = vectorizer.fit_transform(texts)
    priority = LogisticRegression(max_iter=300).fit(vectors, PRIORITIES * len(CATEGORIES))
    category = LogisticRegression(max_iter=300).fit(vectors, [c for c in CATEGORIES for _ in PRIORITIES])
    joblib.dump({'vectorizer': vectorizer, 'priority': priority, 'category': category,
                 'metadata': {'trained': True, 'modelVersion': 'synthetic-unit-fixture'}}, tmp_path/'model.joblib')
    classifier = TextClassifier(tmp_path)
    result = classifier.predict(texts[0])
    expected = priority.predict_proba(vectorizer.transform([texts[0]]))[0]
    np.testing.assert_allclose(list(result['probabilities'].values()), expected)
    assert 0 <= result['severityScore'] <= 1
    assert result['features']
    assert classifier.predict('unseenlexeme')['status'] == 'out_of_vocabulary'
