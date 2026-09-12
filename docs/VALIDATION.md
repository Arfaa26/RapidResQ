# Validation record

Validated locally on 12-13 September 2026 against the existing React web-app based on commit 23864c3.

| Check | Result |
|---|---|
| Frontend lint and production build | Passed |
| Express/TypeScript build | Passed |
| Node, GPS, API, PostgreSQL, score-formatting and hosted-transport tests | 36 passed |
| Python ML, MEDIC, video, training, evaluation and pipeline tests | 31 passed |
| Three official pretrained snapshots + YOLOX-Nano ONNX | Downloaded, revision-pinned and loaded successfully |
| MEDIC disaster classifier training & test evaluation | 63,194 cleaned images; 15,554 test samples (64.3% accuracy, 88.8% accepted accuracy @ 0.70 threshold) |
| MEDIC model reload and inference latency verification (`verify_medic.py`) | Passed |
| Video frame sampling (PyAV) and YOLOX object detection | Passed |
| Local Node to FastAPI HTTP workflow with real pretrained & trained weights | Passed |
| Browser checks | Citizen text/photo preview, authority prediction/duplicate details, ready-model evaluation panels checked |
| Domain emergency dispatch accuracy | Not measured; MEDIC provides disaster image classification, not dispatch priority |

The HTTP workflow sent synthetic image, video and text payloads through the existing Node preview and submission endpoints to actual SigLIP 2, DeBERTa, MEDIC and YOLOX inference. It checked genuine normalized scores, explicit uncalibrated provenance, mandatory review, local incident persistence, real MiniLM duplicate scoring, authority confirmation, idempotent counts, retained media, grouped citizen status, the hotspot API and an evaluation page with no fabricated metrics.

MEDIC disaster classification was trained from the official QCRI MEDIC snapshot (71,198 raw records -> 63,194 cleaned images after deduplication and label-conflict resolution). The MobileNetV3-Small transfer-learning head achieved 64.3% overall test accuracy and 88.8% accepted accuracy at the 0.70 confidence threshold on 15,554 held-out test images. Model reloading and held-out latency verification (`verify_medic.py`) confirmed expected performance.

Video processing decodes up to 6 timestamped frames (max 30s, 1080p, 4MB) with PyAV and runs scene classification and YOLOX-Nano object detection (persons, vehicles) without claiming trained temporal anomaly detection.

The Python suite retains the original isolated MobileNet/Grad-CAM and fitted Logistic Regression checks, leakage checks, DBSCAN and training/evaluation tests. Added tests cover MEDIC data preparation, model training/inference/uncertainty, YOLOX detection, video decoding, missing pretrained snapshots without network access, mandatory authority review, bounded semantic candidates and explicit failure fallback.

## Fresh location reporting

The browser requests high-accuracy, uncached device positions and keeps the map updated from a shared live watch. Normal report submission accepts a reading at most 15 seconds old. If needed, acquisition waits up to ten seconds for a fix within 50 m; otherwise it sends the best fresh observation with its actual estimated accuracy. Coordinates retain the device precision and original timestamp. Malformed or unavailable readings never become an invented location.

The home/report screens display capture age, estimated uncertainty and coordinates. The map retains its accuracy circle. SOS uses a fresh observation promptly and may fall back to an explicitly timestamped reading up to five minutes old if refresh fails, but never after permission denial. A browser cannot guarantee GPS-level accuracy on hardware without a good location signal.

Validation after this change: 36 Node/GPS/API/PostgreSQL/formatting tests passed; 31 Python tests passed; frontend lint, production build and backend build passed. Added GPS tests cover movement, stale-cache avoidance, refinement, coarse-signal deadlines, permission denial and invalid device data. Physical phone GPS accuracy still requires a test on the user's device.

