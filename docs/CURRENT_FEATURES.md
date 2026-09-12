# RapidResQ: current features and model inventory

## Current status

The React/Node website and existing Neon PostgreSQL database are deployed on Vercel. Pretrained triage models and the verified MEDIC disaster classifier now run in the ML service. Public photo/video/text inference, YOLOX-Nano object detection, hosted MiniLM duplicate scoring and the public hotspot endpoint are integrated. Free hosting has queues, daily quotas and cold starts; unavailable requests retain explicit manual review. Moving ML Evaluation into Developer does not change incident inference.

## Citizen reporting

- Existing mobile-style interface, onboarding, home screen and navigation.
- Incident title/description, photo or video attachment, and category selection: fire, accident, flood, medical, crime, civic/pothole, or not sure.
- Photo/video/text ML preview when the ML service is reachable. Photos receive MEDIC-trained disaster classification, YOLOX-Nano object detection and SigLIP/DeBERTa suggestions; videos receive PyAV frame sampling, YOLOX-Nano object evidence and SigLIP scene classification.
- Device location with high-accuracy uncached acquisition, live watch updates, coordinates, estimated accuracy, capture age and a map uncertainty circle.
- Normal reports require a reading from the last 15 seconds. GPS acquisition allows up to ten seconds to improve accuracy; coarse readings stay labeled with their actual uncertainty. Physical accuracy depends on device/signal.
- Submitted reports retain evidence, location and timestamps, and appear in the authority feed.
- Citizen status tracking, assigned-unit information, timeline notes and resolution proof photos. Status is refreshed through API polling.
- Community incident map and alert list; location sharing/copying through supported browser features.
- SOS creates a critical report in the authority dashboard. A last-known timestamped location can be used when refresh fails, within the documented age limit. This does not dispatch an official ambulance or contact 112.
- Five-minute safety timer while the home component is active. It is an in-page timer, not a guaranteed background service when the app is closed or suspended.

## Authority workflow

- Main dashboard views: Incidents and Hotspot Analytics. ML Evaluation is no longer a main dashboard tab.
- Counts for total, critical active, high active, pending, resolved and possible duplicates.
- Department/status filters, live incident feed, map markers and report detail dialog.
- Original evidence, reporter information, suggested department, priority and model explanations.
- Acknowledge, in-progress and resolved workflow; unit name, badge, ETA, notes and resolution evidence.
- Optional browser sound alerts for incoming reports.
- Possible-duplicate review: inspect source evidence, confirm or reject, preserve both reports and update report counts once. Confirmed reports follow the primary report's status.

## Integrated ML models

| Purpose | Exact model / Dataset | Source |
|---|---|---|
| Photo disaster classification (trained) | MobileNetV3-Small linear head on MEDIC | QCRI MEDIC dataset (CC BY-NC-SA 4.0) |
| Person/vehicle object evidence | `yolox_nano.onnx` (YOLOX-Nano) | Megvii YOLOX (Apache 2.0) |
| Video frame sampling | PyAV frame extraction (up to 6 frames, <=30s, 4MB) | Local decoding |
| Photo category suggestions | `google/siglip2-base-patch16-224` | https://huggingface.co/google/siglip2-base-patch16-224 |
| English text category and urgency suggestions | `MoritzLaurer/deberta-v3-base-zeroshot-v2.0` | https://huggingface.co/MoritzLaurer/deberta-v3-base-zeroshot-v2.0 |
| Multilingual duplicate text similarity | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 |

The image adapter returns top-three relative candidate scores and an uncertainty path. The MEDIC classifier returns calibrated disaster probabilities with a 0.70 confidence threshold and abstention handling. The text adapter compares category/urgency descriptions, including insufficient-information handling. Scores are suggestions, not validated emergency dispatch determinations. All triage requires human review.

## Supporting analysis

- Explainable image/text fusion and deterministic department recommendations. Fusion is a documented policy, not a separately trained model.
- Duplicate suggestions combine MiniLM or lexical TF-IDF similarity, image pHash, approximately 200 m distance and a two-hour window. Thresholds and candidate limits are disclosed and still need real-data validation.
- DBSCAN identifies observed geographic clusters over 24 hours, seven days or thirty days. Maps show cluster counts/categories, with daily historical counts. Confirmed duplicates count once; seeded demos are excluded. No future forecasting.

## Developer and training tools

- Developer -> ML Evaluation: model readiness/version, saved held-out metrics, per-class results, confusion matrices and measured inference latency.
- MEDIC dataset pipeline: download, clean/deduplicate (63,194 images), train MobileNetV3-Small classifier, and evaluate on 15,554 test images (64.3% accuracy, 88.8% accepted accuracy @ 0.70 threshold).
- Modular supervised video training pipeline: `prepare_ucf.py`, `extract_video.py`, `train_video.py` for UCF-Crime / XD-Violence integration.
- Optional MobileNetV3-Small image training with real Grad-CAM, and TF-IDF/Logistic Regression text training. These are retained baselines, not the active pretrained stack.
- Dataset manifest templates, event-based train/validation/test separation, leakage checks and separate evaluation scripts.
- Explicit revision-pinned model download, inference within the configured ML host, private Node-to-Python connection, timeout/manual-review fallback and Docker configuration. Public report content is sent to the project's Hugging Face Space for inference, not uploaded to model repositories or used for training.
- Existing simulation controls for fire/accident/civic incidents, reset and split-view demonstration.

## Infrastructure

React/Vite frontend -> Express/Node main API -> Gradio ZeroGPU hosted model service (FastAPI locally). Existing Neon PostgreSQL stores incident JSON and uploaded evidence. GitHub's `web-app` branch deploys the website to Vercel and model source to Hugging Face through a repository-scoped trusted publisher. No new incident-table migration was needed for the ML metadata.

## Not implemented or not yet validated

- Free ML hosting does not provide guaranteed uninterrupted availability; queues, quotas and sleep can delay or prevent inference.
- No reviewed RapidResQ dispatch-priority ground-truth dataset is available. MEDIC provides disaster image classification, not full emergency dispatch priority.
- Supervised temporal video anomaly model remains `training_required` pending permitted video dataset acquisition; deployed video feature uses frame-sampled SigLIP scene classification and YOLOX object detection.
- The Developer label organizes tools; it does not add login or access control. Authenticated users and authority roles are not implemented.
- User/profile details and emergency-contact call screens contain demonstration data. Contact calling is simulated; there is no official emergency-service, SMS or automatic phone-dispatch integration.
- The existing Voice Record shortcut opens the report form; audio recording/transcription is not implemented.
- No pretrained SigLIP heatmap, validated medical diagnosis, automated crime determination or future-risk forecasting.

## Verification

Frontend lint and frontend/backend builds passed, along with 36 Node/GPS/API/PostgreSQL/transport tests and 31 Python tests. Preprocessing and training on 63,194 cleaned MEDIC disaster images completed and evaluated on 15,554 test images. Model reloading and held-out test predictions verified. These software checks are not domain emergency-dispatch accuracy measurements.
