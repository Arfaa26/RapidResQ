import argparse
from pathlib import Path
from uuid import uuid4
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from training.data import read_manifest, metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--output', default='models/text')
    args = parser.parse_args()
    rows, fingerprint = read_manifest(args.manifest, 'text')
    train, val = ([r for r in rows if r['split'] == s] for s in ['train', 'val'])
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, max_features=30000)
    x_train = vectorizer.fit_transform([r['text'] for r in train])
    x_val = vectorizer.transform([r['text'] for r in val])
    models = {}
    selected = {}
    for target in ['priority', 'category']:
        best_score = -1.
        for c in [.25, 1., 4.]:
            classifier = LogisticRegression(C=c, class_weight='balanced', max_iter=2000, random_state=42)
            classifier.fit(x_train, [r[target] for r in train])
            score = float(f1_score([r[target] for r in val], classifier.predict(x_val), average='macro', zero_division=0))
            if score > best_score:
                best_score, models[target] = score, classifier
                selected[target] = {'C': c, 'validationMacroF1': score}
        print(f'{target}: {selected[target]}')
    meta = metadata(rows, fingerprint, 'tfidf-logreg-' + uuid4().hex[:12], 'TF-IDF + Logistic Regression')
    meta.update({'selection': selected, 'seed': 42})
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    joblib.dump({'vectorizer': vectorizer, **models, 'metadata': meta}, output / 'model.joblib')
    print(f'Saved trained text models to {output}. Test evaluation must be run separately.')


if __name__ == '__main__':
    main()
