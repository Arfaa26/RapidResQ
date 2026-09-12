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
    image_usable = image_ready and not image.get('uncertain', False)
    text_category_usable = text_ready and not text.get('uncertain', False)
    text_severity_usable = text_ready and text.get('severityScore') is not None
    pretrained = any(m.get('inferenceMode') == 'pretrained_zero_shot' for m in [image, text])
    score_name = 'relative candidate score' if pretrained else 'classifier probability'
    evidence = []
    if image_usable:
        category, confidence = image['label'], image['confidence']
        evidence.append(f"Image suggests {category}; {score_name} {confidence:.3f}.")
    elif text_category_usable:
        category = text['category']
        confidence = text['categoryProbabilities'][category]
        evidence.append(f"Text suggests category {category}; {score_name} {confidence:.3f}.")
    else:
        category, confidence = (hint if hint in CATEGORIES else 'HAZARD'), None
    score = None
    needs_review = pretrained or not (image_usable and text_category_usable and text_severity_usable)
    if pretrained:
        evidence.append('Pretrained ML-assisted triage; scores are uncalibrated and authority review is required. Text analysis supports English.')
    if image_ready and not image_usable:
        evidence.append('Image evidence is unclear or outside the incident categories; no category is forced from the image.')
    if text_ready and not text_severity_usable:
        evidence.append('Text urgency is uncertain; HIGH is the manual-review queue policy, not a predicted severity.')
    if image_usable and text_severity_usable:
        image_risk = sum(p * RISK.get(c, .5) for c, p in image['probabilities'].items())
        score = .8 * text['severityScore'] + .2 * image_risk
        evidence.append(f"Policy score = 0.8 × text severity {text['severityScore']:.3f} + 0.2 × image category risk {image_risk:.3f}.")
        if category != text['category']:
            needs_review = True
            evidence.append('Image and text categories disagree; authority review required.')
    elif text_severity_usable:
        score = text['severityScore']
        evidence.append('Text-only score; image evidence unavailable.')
    elif image_usable:
        evidence.append('An image category alone cannot establish severity; HIGH pending authority review.')
    else:
        evidence.append('No usable severity evidence. HIGH is a manual-review queue policy, not a prediction.')
    if category == 'HAZARD' or (not image_usable and not text_category_usable):
        evidence.append('Category is uncertain or uses the citizen selection; authority must verify the department.')
    for model in [image, text]:
        if model.get('status') not in ('ready', 'not_provided'):
            evidence.append(f"Model state: {model.get('status')}. {model.get('explanation') or model.get('error') or ''}")
    if score is not None:
        # Context is resolved by Node from an explicitly configured geographic dataset.
        if context and context.get('populatedArea') is True and context.get('source'):
            score = min(1., score + .10)
            evidence.append(f"+0.10 populated-area policy adjustment; source: {context['source']}.")
        else:
            evidence.append('No verified location context; no context adjustment.')
        priority = 'CRITICAL' if score >= .8 else 'HIGH' if score >= .5 else 'MEDIUM' if score >= .25 else 'LOW'
        if text_severity_usable and text.get('priority') == 'CRITICAL':
            priority = 'CRITICAL'
            evidence.append('Policy preserves the text model’s CRITICAL classification.')
    else:
        priority = 'HIGH'
    if confidence is not None and confidence < .6:
        needs_review = True
        evidence.append(f'Category {score_name} below 0.60; authority review required.')
    if text_ready and text['confidence'] < .6:
        needs_review = True
        evidence.append(f'Text priority {score_name} below 0.60; authority review required.')
    return {'confidence': confidence, 'detectedCategory': category, 'priority': priority,
            'department': department(category, priority), 'hazardType': category.replace('_', ' '),
            'extractedKeywords': [x['feature'] for x in text.get('features', [])],
            'recommendedAction': 'Authority to verify evidence, priority and department before dispatch.',
            'reasoning': ' '.join(evidence), 'needsReview': needs_review,
            'status': 'ready' if image_ready and text_ready else 'partial' if image_ready or text_ready else 'setup_required' if pretrained else 'training_required',
            'source': 'ml' if image_ready or text_ready else 'manual_review',
            'image': image, 'text': text,
            'fusion': {'version': 'policy-v2-pretrained' if pretrained else 'policy-v1', 'score': score, 'isProbability': False, 'steps': evidence, 'context': context}}
