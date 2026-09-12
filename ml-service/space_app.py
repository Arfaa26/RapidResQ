"""Free Gradio ZeroGPU adapter. Keep the regular FastAPI entry point for local use."""
import spaces  # Must initialize ZeroGPU before importing torch.
import base64
import hmac
import json
import os
import subprocess
import sys

import gradio as gr
from pydantic import BaseModel, Field

os.environ['ML_REQUIRE_KEY'] = '1'
os.environ['ML_MODEL_MODE'] = 'pretrained'

# An explicit startup setup step; inference itself uses local files only.
subprocess.run([sys.executable, '-m', 'pretrained.download'], check=True)
subprocess.run([sys.executable, '-m', 'detector.download'], check=True)

import app as service
from analytics import duplicates, hotspots
from schemas import DuplicateRequest, HotspotRequest

service.initialize_models(service.app)
for kind in ('image', 'text', 'similarity'):
    adapter = getattr(service.app.state, kind)
    if adapter.model is None:
        raise RuntimeError(f'{kind} failed to load; deployment is not ready')
    adapter.model.to('cuda')
service.app.state.image.text_features = service.app.state.image.text_features.to('cuda')


class AnalysisInput(BaseModel):
    title: str = Field(default='', max_length=500)
    description: str = Field(default='', max_length=10000)
    categoryHint: str = Field(default='', max_length=30)
    context: str = Field(default='{}', max_length=2000)
    explain: bool = False
    media: str | None = Field(default=None, max_length=5_592_408)
    mimeType: str = Field(default='', max_length=100)


@spaces.GPU(duration=15)
def gpu_analysis(request, context, prepared):
    return service.analyze_bytes(None, request.mimeType, request.title, request.description,
                                 request.categoryHint, request.explain, context, prepared=prepared)


def analysis_request(payload):
    request = AnalysisInput.model_validate(payload)
    context = json.loads(request.context)
    if not isinstance(context, dict):
        raise ValueError('Context must be a JSON object')
    raw = base64.b64decode(request.media, validate=True) if request.media else None
    if raw and len(raw) > service.MAX_BYTES:
        raise ValueError('Maximum upload is 4 MB')
    prepared = service.prepare_media(raw, request.mimeType)
    if prepared.get('disaster', {}).get('status') == 'ready' and not (request.title + request.description).strip():
        return service.analyze_bytes(None, request.mimeType, request.title, request.description,
            request.categoryHint, request.explain, context, prepared=prepared, text_override={'status': 'not_provided'})
    try:
        return gpu_analysis(request, context, prepared)
    except Exception:
        # Keep real CPU MEDIC predictions when free GPU text inference is unavailable.
        if prepared.get('disaster', {}).get('status') != 'ready':
            raise
        return service.analyze_bytes(None, request.mimeType, request.title, request.description,
            request.categoryHint, request.explain, context, prepared=prepared,
            text_override={'status': 'unavailable', 'explanation': 'Text analysis is temporarily unavailable. The MEDIC photo prediction is retained; urgency requires manual review.'})


@spaces.GPU(duration=15)
def gpu_duplicates(payload):
    return duplicates(DuplicateRequest.model_validate(payload), service.app.state.similarity)


def dispatch(payload, service_key):
    expected = os.environ['ML_SERVICE_KEY']
    if not isinstance(service_key, str) or not hmac.compare_digest(expected, service_key):
        raise gr.Error('Invalid service key')
    if not isinstance(payload, dict):
        raise gr.Error('Request must be an object')
    endpoint = payload.get('endpoint')
    body = payload.get('body') or {}
    if endpoint == '/health':
        return {**service.health(), 'hosting': 'gradio_zerogpu_free'}
    if endpoint == '/evaluation':
        return service.evaluation()
    if endpoint == '/predict-image':
        request = AnalysisInput.model_validate(body)
        raw = base64.b64decode(request.media, validate=True) if request.media else b''
        if not raw or len(raw) > service.MAX_BYTES or not request.mimeType.startswith('image/'):
            raise gr.Error('Upload an image smaller than 4 MB')
        prepared = service.prepare_media(raw, request.mimeType)
        if prepared['kind'] != 'image':
            raise gr.Error(prepared.get('explanation', 'Invalid image'))
        return prepared['disaster']
    if endpoint == '/analyze':
        return analysis_request(body)
    if endpoint == '/duplicates':
        return gpu_duplicates(body)
    if endpoint == '/hotspots':
        return hotspots(HotspotRequest.model_validate(body))
    raise gr.Error('Unknown operation')


with gr.Blocks(analytics_enabled=False) as demo:
    gr.Markdown('# RapidResQ ML Service\n'
                'Pretrained photo/video-frame/text triage and YOLOX object evidence and duplicate suggestions for RapidResQ. '
                'All suggestions require authority review. No project accuracy is claimed.\n\n'
                'This free demonstration uses shared GPU capacity, with daily quotas and possible queues. '
                'The citizen interface is hosted on Vercel. Service access requires its private key.')
    request = gr.JSON(label='Service request')
    key = gr.Textbox(label='Service key', type='password')
    output = gr.JSON(label='Result')
    gr.Button('Run request').click(dispatch, [request, key], output, api_name='dispatch', concurrency_limit=1)

demo.queue(max_size=8).launch(server_name='0.0.0.0', show_error=False, max_file_size='4mb')
