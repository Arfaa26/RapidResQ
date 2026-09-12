---
title: RapidResQ ML
emoji: 🚨
colorFrom: purple
colorTo: blue
sdk: gradio
sdk_version: 6.27.0
python_version: '3.12'
app_file: space_app.py
pinned: false
startup_duration_timeout: 1h
---

RapidResQ's pretrained image and text triage service on free Gradio ZeroGPU.
Set `ML_SERVICE_KEY` as a Space secret before startup. The API requires this key.
Models download from pinned public revisions at startup, then run inside this
Space. No RapidResQ fine-tuning or evaluated accuracy is claimed.

Free hosting has daily GPU quotas, queues and cold starts. Failed requests retain
the website's manual-review fallback. This is a project demonstration deployment.
