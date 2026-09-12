import hmac
import asyncio
import io
import json
import os
import time
import warnings
from contextlib import asynccontextmanager
from pathlib import Path

import imagehash
import torch
from fastapi import FastAPI, Depends, File, Form, Header, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from analytics import duplicates, hotspots
from detector.model import ObjectDetector
from medic.model import MedicClassifier, as_visual_prediction
from video.temporal import TemporalClassifier
from video.decoder import sample_video, VideoError
from video.analysis import analyze_frames
from fusion import fuse
from image_model.model import ImageClassifier
from schemas import DuplicateRequest, HotspotRequest
from text_model.model import TextClassifier

ROOT = Path(__file__).resolve().parent
MODEL_DIR = Path(os.environ.get('MODEL_DIR', ROOT / 'models'))
MAX_BYTES = 4 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000
warnings.simplefilter('error', Image.DecompressionBombWarning)
torch.set_num_threads(int(os.environ.get('TORCH_NUM_THREADS', '2')))


@asynccontextmanager
async def lifespan(app):
    initialize_models(app)
    yield


def initialize_models(app):
    if os.environ.get('ML_REQUIRE_KEY') == '1' and not os.environ.get('ML_SERVICE_KEY'):
        raise RuntimeError('ML_SERVICE_KEY is required for the hosted ML service.')
    app.state.mode = os.environ.get('ML_MODEL_MODE', 'pretrained')
    if app.state.mode not in ('pretrained', 'trained'):
        raise RuntimeError('ML_MODEL_MODE must be pretrained or trained')
    if app.state.mode == 'pretrained':
        from pretrained.models import PretrainedImageClassifier, PretrainedTextClassifier, SemanticMatcher
        app.state.image = PretrainedImageClassifier(MODEL_DIR / 'pretrained' / 'image')
        app.state.text = PretrainedTextClassifier(MODEL_DIR / 'pretrained' / 'text')
        app.state.similarity = SemanticMatcher(MODEL_DIR / 'pretrained' / 'similarity')
    else:
        app.state.image = ImageClassifier(MODEL_DIR / 'image')
        app.state.text = TextClassifier(MODEL_DIR / 'text')
        app.state.similarity = None
    app.state.detector = ObjectDetector(MODEL_DIR / "detector")
    app.state.medic = MedicClassifier(MODEL_DIR / "disaster_classifier")
    app.state.temporal = TemporalClassifier(MODEL_DIR / "video", app.state.image.status().get("modelVersion"))
    app.state.inference_gate = asyncio.Semaphore(1)


def authorize(x_ml_service_key: str | None = Header(default=None)):
    key = os.environ.get('ML_SERVICE_KEY')
    if key and not hmac.compare_digest(key, x_ml_service_key or ''):
        raise HTTPException(401, 'Invalid ML service key')


app = FastAPI(title='RapidResQ ML Service', version='1.0.0', lifespan=lifespan,
              dependencies=[Depends(authorize)])


@app.get('/health')
def health():
    return {'status': 'ok', 'mode': app.state.mode, 'detector': app.state.detector.status(), 'medic': app.state.medic.status(),
            'video': {'status': 'ready', 'method': 'sampled_frames', 'maxSeconds': 30, 'maxFrames': 6, 'audioAnalyzed': False, 'temporalModel': app.state.temporal.status()['status']}, 'image': app.state.image.status(), 'text': app.state.text.status(),
            'similarity': app.state.similarity.status() if app.state.similarity else {'status': 'lexical_fallback'}}


async def bounded_inference(function, *args):
    # Reject overload instead of allowing abandoned preview requests to form an unbounded queue.
    try:
        await asyncio.wait_for(app.state.inference_gate.acquire(), timeout=.5)
    except TimeoutError:
        raise HTTPException(503, 'ML service busy; retry shortly or submit for manual review')
    try:
        return await run_in_threadpool(function, *args)
    finally:
        app.state.inference_gate.release()


def prepare_media(raw, mime):
    """CPU parsing/detection runs before requesting scarce ZeroGPU capacity."""
    start = time.perf_counter()
    prepared = {'kind': 'none', 'imageHash': None}
    if raw and mime.startswith('video/'):
        try:
            sample = sample_video(raw)
            evidence = [{**app.state.detector.predict(image), 'timestampSeconds': timestamp}
                        for timestamp, image in sample['frames']]
            disaster_res = app.state.medic.predict_frames([image for _, image in sample['frames']])
            if disaster_res.get('status') == 'ready':
                disaster_res['frames'] = [{**app.state.medic.predict(image), 'timestampSeconds': timestamp}
                                          for timestamp, image in sample['frames']]
            prepared.update(kind='video', sample=sample, objects=evidence, disaster=disaster_res)
        except VideoError as error:
            prepared.update(kind='invalid_video', explanation=str(error))
    elif raw and mime.startswith('image/'):
        try:
            image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
            image.load()
            from PIL import ImageStat
            if max(ImageStat.Stat(image).stddev) >= 5:
                prepared['imageHash'] = str(imagehash.phash(image))
            prepared.update(kind='image', image=image, objects=[app.state.detector.predict(image)], disaster=app.state.medic.predict(image))
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            prepared.update(kind='invalid_image', explanation='The photo is unreadable; try a JPEG or PNG.')
    elif raw:
        prepared.update(kind='unsupported_media', explanation='Use a photo or short MP4, MOV or WebM video.')
    prepared['preparationMs'] = (time.perf_counter() - start) * 1000
    return prepared


def analyze_bytes(raw, mime, title, description, category_hint, explain, context, prepared=None, text_override=None):
    start = time.perf_counter()
    already_prepared = prepared is not None
    prepared = prepared if already_prepared else prepare_media(raw, mime)
    image_result = {'status': 'not_provided', 'top3': [], 'probabilities': None}
    video_result = None
    if prepared['kind'] == 'image':
        image_result = (as_visual_prediction(prepared['disaster']) if prepared['disaster']['status'] == 'ready'
                        else app.state.image.predict(prepared['image'], explain=explain))
    elif prepared['kind'] == 'video':
        if prepared.get('disaster', {}).get('status') == 'ready' and not prepared['disaster'].get('lowConfidence') and prepared['disaster'].get('predictedLabel') != 'not_disaster':
            image_result = as_visual_prediction(prepared['disaster'])
            _, video_result = analyze_frames(prepared['sample'], app.state.image, app.state.temporal)
        else:
            image_result, video_result = analyze_frames(prepared['sample'], app.state.image, app.state.temporal)
    elif prepared['kind'] != 'none':
        image_result = {'status': prepared['kind'], 'top3': [], 'probabilities': None,
                        'explanation': prepared.get('explanation')}
        if prepared['kind'] == 'invalid_video':
            video_result = {'status': 'invalid_video', 'method': 'sampled_frames', 'frames': [],
                            'sampledFrameCount': 0, 'analyzedFrameCount': 0, 'audioAnalyzed': False,
                            'explanation': prepared['explanation']}
    text_result = text_override if text_override is not None else app.state.text.predict(f'{title} {description}')
    result = fuse(image_result, text_result, category_hint, context)
    if prepared.get('disaster'):
        result['disaster'] = prepared['disaster']
        result['needsReview'] = True
        if prepared['disaster']['status'] == 'ready':
            result['reasoning'] += ' ' + prepared['disaster']['message']
    if video_result:
        result['video'] = video_result
        result['needsReview'] = True
        result['reasoning'] += ' ' + video_result['explanation']
    if prepared.get('objects'):
        result['objects'] = {**app.state.detector.status(), 'frames': prepared['objects']}
    result['priorityCode'] = {'CRITICAL': 'P1', 'HIGH': 'P2', 'MEDIUM': 'P3', 'LOW': 'P4'}[result['priority']]
    result['imageHash'] = prepared['imageHash']
    result['latencyMs'] = (time.perf_counter() - start) * 1000 + (prepared.get('preparationMs', 0) if already_prepared else 0)
    return result


@app.post('/analyze')
async def analyze(title: str = Form(default='', max_length=500), description: str = Form(default='', max_length=10000),
                  categoryHint: str = Form(default='', max_length=30), context: str = Form(default='{}', max_length=2000),
                  explain: bool = Form(default=False), media: UploadFile | None = File(default=None)):
    try:
        parsed_context = json.loads(context)
        if not isinstance(parsed_context, dict):
            raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(422, 'Context must be a JSON object')
    raw = await media.read(MAX_BYTES + 1) if media else None
    if media:
        await media.close()
    if raw and len(raw) > MAX_BYTES:
        raise HTTPException(413, 'Maximum upload is 4 MB')
    return await bounded_inference(analyze_bytes, raw, media.content_type or '' if media else '',
                                  title, description, categoryHint, explain, parsed_context)


@app.post('/predict-image')
async def predict_disaster(media: UploadFile = File()):
    mime = media.content_type or ''
    raw = await media.read(MAX_BYTES + 1)
    await media.close()
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, 'Maximum upload is 4 MB')
    if not mime.startswith('image/'):
        raise HTTPException(422, 'Upload an image')
    prepared = await bounded_inference(prepare_media, raw, mime)
    if prepared['kind'] != 'image':
        raise HTTPException(422, prepared.get('explanation', 'Invalid image'))
    return prepared['disaster']


@app.post('/duplicates')
async def duplicate_check(request: DuplicateRequest):
    return await bounded_inference(duplicates, request, app.state.similarity)


@app.post('/hotspots')
def hotspot_analysis(request: HotspotRequest):
    return hotspots(request)


@app.get('/evaluation')
def evaluation():
    results = {}
    for name in ['image', 'text']:
        model = getattr(app.state, name)
        artifact = (MODEL_DIR / 'evaluation-pretrained' / name / 'evaluation.json' if app.state.mode == 'pretrained'
                    else MODEL_DIR / name / 'evaluation.json')
        result = None
        if artifact.exists():
            try:
                candidate = json.loads(artifact.read_text(encoding='utf-8'))
                if (model.status()['status'] == 'ready' and candidate.get('modelVersion') == model.status()['modelVersion']
                        and candidate.get('split') == 'test' and candidate.get('sampleCount', 0) > 0):
                    result = candidate
            except (ValueError, OSError):
                pass
        results[name] = {'status': 'evaluated' if result else 'evaluation_required',
                         'model': model.status(), 'evaluation': result}
    medic = app.state.medic
    medic_evaluation = None
    artifact = MODEL_DIR / 'disaster_classifier' / 'evaluation.json'
    if medic.model is not None and artifact.exists():
        saved = json.loads(artifact.read_text(encoding='utf-8'))
        if saved['modelVersion'] == medic.metadata['modelVersion']:
            report = saved['perClass']
            medic_evaluation = {**saved, 'algorithm': medic.status()['architecture'],
                'abstentionCount': saved['lowConfidenceCount'],
                'abstentionPolicy': 'Raw top-class metrics include low-confidence images; accepted accuracy uses only predictions above the threshold.',
                'metrics': {'disaster': {'accuracy': saved['accuracy'], 'precision': report['macro avg']['precision'],
                    'recall': report['macro avg']['recall'], 'f1': saved['macroF1'], 'averaging': 'macro',
                    'labels': saved['labels'], 'confusionMatrix': saved['confusionMatrix'],
                    'perClass': {label: report[label] for label in saved['labels']}}}}
    results['medic'] = {'status': 'evaluated' if medic_evaluation else 'evaluation_required',
                        'model': medic.status(), 'evaluation': medic_evaluation}
    return results
