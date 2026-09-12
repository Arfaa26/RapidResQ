---
title: RapidResQ ML
emoji: 🚨
colorFrom: purple
colorTo: blue
sdk: gradio
sdk_version: 6.9.0
python_version: '3.12'
app_file: space_app.py
pinned: false
startup_duration_timeout: 1h
---

RapidResQ photo/video/text triage on free hosting.

- MEDIC-trained MobileNetV3-Small disaster photo classifier, running on CPU.
- YOLOX-Nano person/vehicle evidence, running on CPU.
- SigLIP 2 sampled video scenes, DeBERTa text suggestions and MiniLM duplicate embeddings on shared ZeroGPU.

Set `ML_SERVICE_KEY` as a Space secret. The service requires this private key.
Only approved MEDIC model weights and evaluation ship with the service. Raw datasets are excluded.
Other pinned model weights download at startup. MEDIC metrics apply to its cleaned official image test split,
not citizen emergencies or dispatch severity. All suggestions require authority review.

MEDIC: https://crisisnlp.qcri.org/medic/ — CC BY-NC-SA 4.0, non-commercial research.
See THIRD_PARTY_NOTICES.md and models/disaster_classifier/LICENSE.txt for attribution and license.

Free hosting has GPU quotas, queues and cold starts. Real CPU photo predictions are retained when GPU text
inference fails and the service remains reachable. Video checks sample up to six frames from 30-second,
1080p, 4 MB clips; no audio or trained temporal anomaly-model claim. This is a project demonstration.
