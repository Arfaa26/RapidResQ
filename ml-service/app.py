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
    app.state.inference_gate = asyncio.Semaphore(1)


def authorize(x_ml_service_key: str | None = Header(default=None)):
    key = os.environ.get('ML_SERVICE_KEY')
    if key and not hmac.compare_digest(key, x_ml_service_key or ''):
        raise HTTPException(401, 'Invalid ML service key')


app = FastAPI(title='RapidResQ ML Service', version='1.0.0', lifespan=lifespan,
              dependencies=[Depends(authorize)])


@app.get('/health')
def health():
    return {'status': 'ok', 'mode': app.state.mode, 'image': app.state.image.status(), 'text': app.state.text.status(),
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


def analyze_bytes(raw, mime, title, description, category_hint, explain, context):
    start = time.perf_counter()
    image_result = {'status': 'not_provided', 'top3': [], 'probabilities': None}
    phash = None
    if raw and mime.startswith('image/'):
        try:
            image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
            image.load()
            # Flat images have non-discriminative hashes; do not use them for duplicate matching.
            from PIL import ImageStat
            if max(ImageStat.Stat(image).stddev) >= 5:
                phash = str(imagehash.phash(image))
            image_result = app.state.image.predict(image, explain=explain)
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            image_result = {'status': 'invalid_image', 'top3': [], 'probabilities': None}
    elif raw:
        image_result = {'status': 'unsupported_media', 'top3': [], 'probabilities': None}
    text_result = app.state.text.predict(f'{title} {description}')
    result = fuse(image_result, text_result, category_hint, context)
    result['imageHash'] = phash
    result['latencyMs'] = (time.perf_counter() - start) * 1000
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
    return results
