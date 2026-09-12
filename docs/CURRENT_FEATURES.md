# RapidResQ: current features and model inventory

## Current status

The React/Node website and existing Neon PostgreSQL database are deployed on Vercel. The three pretrained models are installed and working in the local Python service. Public ML inference, semantic duplicates and DBSCAN analytics need that service hosted separately and connected through `ML_SERVICE_URL`. Until then, the public app uses explicit manual-review fallback; it does not invent predictions or accuracy. Moving ML Evaluation into Developer does not change incident inference.

## Citizen reporting

- Existing mobile-style interface, onboarding, home screen and navigation.
- Incident title/description, photo or video attachment, and category selection: fire, accident, flood, medical, crime, civic/pothole, or not sure.
- Photo/text ML preview when the ML service is reachable. Images receive model analysis; videos are retained as evidence, not analyzed by these models.
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

## Integrated pretrained models

| Purpose | Exact model | Source |
|---|---|---|
| Photo category suggestions | `google/siglip2-base-patch16-224` | https://huggingface.co/google/siglip2-base-patch16-224 |
| English text category and urgency suggestions | `MoritzLaurer/deberta-v3-base-zeroshot-v2.0` | https://huggingface.co/MoritzLaurer/deberta-v3-base-zeroshot-v2.0 |
| Multilingual duplicate text similarity | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 |

The image adapter returns top-three relative candidate scores and an uncertainty path. The text adapter compares category/urgency descriptions, including insufficient-information handling. Scores are uncalibrated suggestions, not validated emergency probabilities. All pretrained triage requires human review. The models were pretrained by their publishers; no RapidResQ fine-tuning or task accuracy is claimed.

## Supporting analysis

- Explainable image/text fusion and deterministic department recommendations. Fusion is a documented policy, not a separately trained model.
- Duplicate suggestions combine MiniLM or lexical TF-IDF similarity, image pHash, approximately 200 m distance and a two-hour window. Thresholds and candidate limits are disclosed and still need real-data validation.
- DBSCAN identifies observed geographic clusters over 24 hours, seven days or thirty days. Maps show cluster counts/categories, with daily historical counts. Confirmed duplicates count once; seeded demos are excluded. No future forecasting.

## Developer and training tools

- Developer -> ML Evaluation: model readiness/version, saved held-out metrics, per-class results, confusion matrices and measured inference latency.
- Empty evaluation states remain explicit. Refresh only reloads saved results; it does not train/evaluate a model.
- Optional MobileNetV3-Small image training with real Grad-CAM, and TF-IDF/Logistic Regression text training. These are retained baselines, not the active pretrained stack.
- Dataset manifest templates, event-based train/validation/test separation, leakage checks and separate evaluation scripts.
- Explicit revision-pinned model download, local-only inference, private Node-to-Python connection, timeout/manual-review fallback and Docker configuration.
- Existing simulation controls for fire/accident/civic incidents, reset and split-view demonstration.

## Infrastructure

React/Vite frontend -> Express/Node main API -> FastAPI model service. Existing Neon PostgreSQL stores incident JSON and uploaded evidence. GitHub's `web-app` branch is connected to Vercel production. No new incident-table migration was needed for the ML metadata.

## Not implemented or not yet validated

- Public hosting for the Python ML service is not configured.
- No reviewed RapidResQ test dataset, fine-tuning results or project accuracy is available. The supplied historical disaster CSV was not suitable for photo/text triage training.
- The Developer label organizes tools; it does not add login or access control. Authenticated users and authority roles are not implemented.
- User/profile details and emergency-contact call screens contain demonstration data. Contact calling is simulated; there is no official emergency-service, SMS or automatic phone-dispatch integration.
- The existing Voice Record shortcut opens the report form; audio recording/transcription is not implemented.
- No video classification, pretrained SigLIP heatmap, validated medical diagnosis, automated crime determination or future-risk forecasting.

## Verification

The latest navigation move passed frontend lint, frontend/backend builds and browser verification: the authority dashboard has two operational tabs, and Developer opens the retained evaluation screen. The preceding complete validation passed 29 Node/GPS/API/PostgreSQL/formatting tests and 21 Python tests, plus local real-model HTTP workflow checks. These software checks are not domain accuracy measurements.
