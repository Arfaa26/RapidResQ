---
title: RapidResQ ML Service
emoji: 🚨
colorFrom: purple
colorTo: blue
sdk: docker
app_port: 8000
pinned: false
---

FastAPI service for RapidResQ's pretrained SigLIP 2 image suggestions,
DeBERTa English text triage, MiniLM duplicate comparison and DBSCAN analytics.

Set the private `ML_SERVICE_KEY` Space secret before starting. All application
endpoints require the matching `X-ML-Service-Key` header. This Space is an API
service; the citizen interface is hosted separately on Vercel.

The Docker build downloads the three pinned public model revisions. Reports are
processed inside the running service and are not uploaded to model repositories.
These models have not been fine-tuned or evaluated on RapidResQ incident data.
Scores are uncalibrated and every suggestion requires authority review.
