from collections import Counter
from datetime import datetime, timedelta, timezone
import math
import numpy as np
import imagehash
from sklearn.cluster import DBSCAN
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from schemas import DuplicateRequest, HotspotRequest

EARTH_METERS = 6371008.8


def distance(a, b):
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat, dlng = lat2 - lat1, math.radians(b.lng - a.lng)
    h = math.sin(dlat / 2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlng / 2)**2
    return 2 * EARTH_METERS * math.asin(min(1, math.sqrt(h)))


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def duplicates(request: DuplicateRequest, semantic=None):
    report = request.report
    matches = []
    eligible = [c for c in request.candidates if c.id != report.id and distance(report.location, c.location) <= 200
                and abs((utc(report.createdAt) - utc(c.createdAt)).total_seconds()) <= 7200]
    eligible.sort(key=lambda c: (distance(report.location, c.location), c.id))
    report_text = f'{report.title} {report.description}'.strip()
    semantic_scores = {}
    semantic_status = semantic.status() if semantic else {'status': 'lexical_fallback'}
    selected = []
    budget = 30000 - len(report_text)
    if semantic and semantic_status['status'] == 'ready' and len(report_text.split()) >= 4:
        for candidate in eligible:
            text = f'{candidate.title} {candidate.description}'.strip()
            if len(text.split()) >= 4 and len(selected) < 20 and len(text) <= budget:
                selected.append((candidate.id, text))
                budget -= len(text)
        if selected:
            try:
                scores = semantic.similarities([report_text] + [text for _, text in selected])
                semantic_scores = dict(zip([key for key, _ in selected], scores))
            except Exception:
                import logging
                logging.exception('Semantic matching failed; using explicit lexical fallback')
                semantic_status = {**semantic_status, 'status': 'unavailable'}
    for candidate in request.candidates:
        meters = distance(report.location, candidate.location)
        seconds = abs((utc(report.createdAt) - utc(candidate.createdAt)).total_seconds())
        if candidate.id == report.id or meters > 200 or seconds > 7200:
            continue
        texts = [f'{x.title} {x.description}'.strip() for x in [report, candidate]]
        similarity = 0.
        text_method = 'tfidf'
        # Short/generic one-word reports are not enough evidence for linking.
        if candidate.id in semantic_scores:
            similarity = semantic_scores[candidate.id]
            text_method = 'minilm'
        elif all(len(t.split()) >= 4 for t in texts):
            try:
                vectors = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True).fit_transform(texts)
                similarity = float(cosine_similarity(vectors[0], vectors[1])[0, 0])
            except ValueError:
                pass
        hash_distance = None
        if report.imageHash and candidate.imageHash:
            hash_distance = int(imagehash.hex_to_hash(report.imageHash) - imagehash.hex_to_hash(candidate.imageHash))
        visual_match = hash_distance is not None and hash_distance <= 8
        if visual_match or similarity >= .8:
            matches.append({'incidentId': candidate.id, 'distanceMeters': meters,
                            'timeDifferenceMinutes': seconds/60, 'textSimilarity': similarity,
                            'textMethod': text_method,
                            'imageHashDistance': hash_distance,
                            'locationUncertain': any((p.accuracyMeters or 0) > 200 for p in [report.location, candidate.location]),
                            'reason': 'Within 200 m and 2 hours; ' + ('similar image pHash' if visual_match else f'{text_method} cosine similarity ≥ 0.80 (uncalibrated review threshold)')})
    matches.sort(key=lambda m: (-m['textSimilarity'], m['distanceMeters'], m['incidentId']))
    return {'status': 'checked', 'matches': matches[:5],
            'method': 'phash-minilm-tfidf-geo-time-v2' if semantic_scores else 'phash-tfidf-geo-time-v1',
            'semanticModel': semantic_status, 'semanticCandidatesChecked': len(semantic_scores),
            'semanticCandidatesTruncated': bool(semantic and len(selected) < len(eligible))}


def hotspots(request: HotspotRequest, now=None):
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=request.days)
    reports = [r for r in request.incidents if cutoff <= utc(r.createdAt) <= now]
    coordinates = np.radians([[r.location.lat, r.location.lng] for r in reports])
    labels = DBSCAN(eps=request.radiusMeters / EARTH_METERS, min_samples=request.minSamples,
                    metric='haversine', algorithm='ball_tree').fit_predict(coordinates) if reports else []
    clusters = []
    for label in sorted(set(labels) - {-1}):
        group = [r for r, cluster in zip(reports, labels) if cluster == label]
        categories = dict(Counter(r.category for r in group))
        lat = sum(r.location.lat for r in group)/len(group)
        # Circular longitude mean avoids a false center at Greenwich across the date line.
        lng = math.degrees(math.atan2(sum(math.sin(math.radians(r.location.lng)) for r in group),
                                      sum(math.cos(math.radians(r.location.lng)) for r in group)))
        from schemas import Point
        center = Point(lat=lat, lng=lng)
        clusters.append({'id': f'hotspot-{int(label)}', 'lat': lat, 'lng': lng,
                         'radiusMeters': max(50., max(distance(center, r.location) for r in group)),
                         'count': len(group), 'categories': categories,
                         'mainCategory': max(categories, key=categories.get),
                         'incidentIds': [r.id for r in group]})
    counts = Counter(utc(r.createdAt).strftime('%Y-%m-%d') for r in reports)
    dates = [(cutoff + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(request.days + 1)]
    return {'status': 'ready', 'method': 'DBSCAN', 'days': request.days, 'radiusMeters': request.radiusMeters,
            'minSamples': request.minSamples, 'incidentCount': len(reports),
            'noiseCount': sum(int(x == -1) for x in labels), 'hotspots': clusters,
            'trends': [{'date': d, 'count': counts.get(d, 0)} for d in dates],
            'generatedAt': now.isoformat(), 'forecast': False}
