"""Transparent decision policy, not a trained fusion model or probability of harm."""
from schemas import CATEGORIES

RISK = dict(zip(CATEGORIES, [.8, .7, .7, .8, .7, .25]))


def department(category, priority):
    if category in ('FIRE', 'FLOOD'):
        return 'FIRE_DEPARTMENT'
    if category == 'MEDICAL' or (category == 'ACCIDENT' and priority == 'CRITICAL'):
        return 'EMS_AMBULANCE'
    if category in ('CRIME', 'ACCIDENT'):
        return 'POLICE_DEPARTMENT'
    return 'MUNICIPALITY'


def fuse(image, text, hint=None, context=None):
    image_ready = image.get('status') == 'ready'
    text_ready = text.get('status') == 'ready'
    evidence = []
    if image_ready:
        category, confidence = image['label'], image['confidence']
        evidence.append(f"Image predicts {category}; classifier probability {confidence:.3f}.")
    elif text_ready:
        category = text['category']
        confidence = text['categoryProbabilities'][category]
        evidence.append(f"Text predicts category {category}; classifier probability {confidence:.3f}.")
    else:
        category, confidence = (hint if hint in CATEGORIES else 'HAZARD'), None
    score = None
    needs_review = not (image_ready and text_ready)
    if image_ready and text_ready:
        image_risk = sum(image['probabilities'][c] * RISK[c] for c in CATEGORIES)
        score = .8 * text['severityScore'] + .2 * image_risk
        evidence.append(f"Policy score = 0.8 × text severity {text['severityScore']:.3f} + 0.2 × image category risk {image_risk:.3f}.")
        if category != text['category']:
            needs_review = True
            evidence.append('Image and text categories disagree; authority review required.')
    elif text_ready:
        score = text['severityScore']
        evidence.append('Text-only score; image evidence unavailable.')
    elif image_ready:
        evidence.append('An image category alone cannot establish severity; HIGH pending authority review.')
    else:
        evidence.append('ML unavailable or requires training. Category is a citizen hint; HIGH is a manual-review queue policy, not a prediction.')
    if score is not None:
        # Context is resolved by Node from an explicitly configured geographic dataset.
        if context and context.get('populatedArea') is True and context.get('source'):
            score = min(1., score + .10)
            evidence.append(f"+0.10 populated-area policy adjustment; source: {context['source']}.")
        else:
            evidence.append('No verified location context; no context adjustment.')
        priority = 'CRITICAL' if score >= .8 else 'HIGH' if score >= .5 else 'MEDIUM' if score >= .25 else 'LOW'
        if text_ready and text['priority'] == 'CRITICAL':
            priority = 'CRITICAL'
            evidence.append('Policy preserves the text model’s CRITICAL classification.')
    else:
        priority = 'HIGH'
    if confidence is not None and confidence < .6:
        needs_review = True
        evidence.append('Category probability below 0.60; authority review required.')
    if text_ready and text['confidence'] < .6:
        needs_review = True
        evidence.append('Text priority probability below 0.60; authority review required.')
    return {'confidence': confidence, 'detectedCategory': category, 'priority': priority,
            'department': department(category, priority), 'hazardType': category.replace('_', ' '),
            'extractedKeywords': [x['feature'] for x in text.get('features', [])],
            'recommendedAction': 'Authority to verify evidence, priority and department before dispatch.',
            'reasoning': ' '.join(evidence), 'needsReview': needs_review,
            'status': 'ready' if image_ready and text_ready else 'partial' if image_ready or text_ready else 'training_required',
            'source': 'ml' if image_ready or text_ready else 'manual_review',
            'image': image, 'text': text,
            'fusion': {'version': 'policy-v1', 'score': score, 'isProbability': False, 'steps': evidence, 'context': context}}
