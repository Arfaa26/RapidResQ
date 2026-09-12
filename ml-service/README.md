# RapidResQ ML service

MEDIC is the primary disaster-photo training dataset. Full source, license, label mapping, preprocessing, training commands, model architecture, evaluation and inference details are in [MEDIC integration](../docs/MEDIC_INTEGRATION.md). [Video analysis](../docs/VIDEO_ML.md) documents sampled scenes, YOLOX and the pending supervised temporal dataset work.

To install the verified release model on a new checkout, from this directory run `python -m medic.install` and `python -m detector.download`. These commands install model weights only. To reproduce MEDIC training, follow the separate dataset download/preparation/training instructions. Never copy `datasets/medic/raw` or `datasets/medic/processed` into a deployment.

## Existing general pretrained ML setup

The default service uses genuine pretrained SigLIP 2 (photos), DeBERTa (English text category/urgency), and multilingual MiniLM (duplicate text similarity). Local development runs them in FastAPI. The public deployment sends report content from Vercel to your Hugging Face Space for inference; it does not upload reports to model repositories or use them for training. No training on RapidResQ incident data or domain accuracy is claimed; all pretrained suggestions require authority review.

## Install and start

From the repository root in PowerShell:

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml-service/requirements.txt
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
cd ml-service
..\.venv\Scripts\python.exe -m pretrained.download
$env:ML_MODEL_MODE = 'pretrained'
..\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Preserve any existing `backend/.env` and database credentials. Add `ML_SERVICE_URL=http://127.0.0.1:8000`. In a second terminal at the repository root, run `npm run dev`, then open `http://localhost:3000`.

The one-time download is roughly 2.4 GB plus dependencies/caches and is resumable. Official upstream revisions are pinned in `pretrained/models.lock.json`. Only configuration, tokenizers, documentation and safetensors are fetched; remote Python code is never executed. Snapshots live in `models/pretrained/{image,text,similarity}`, ignored by Git and excluded from the source ZIP. Run the download command on a new computer. Inference uses local files only. Wait for “Application startup complete” and restart after changing Python code or weights. Missing snapshots show `setup_required` and manual review.

## What the models do

- **SigLIP 2:** compares a photo with the six incident scene descriptions plus an ordinary/unclear option (`HAZARD`). Returns top three relative softmax scores and separate sigmoid image-text match scores. The compatibility API field is named `probabilities`, but `scoreType=relative_candidate_score` and `calibrated=false` distinguish its meaning. These are not verified incident probabilities. Initial uncertainty thresholds: top score below 0.60, top-two gap below 0.15, sigmoid match below 0.10, or the unclear option winning. These need validation. A photo does not establish crime or a medical diagnosis. No fake Grad-CAM is produced; this adapter explicitly reports heatmaps unsupported.
- **DeBERTa:** compares English reports against fixed category and urgency descriptions, including `UNSPECIFIED` urgency. Descriptions and their scores are visible in model details. No invented keyword attribution is returned. Reports above 300 tokenizer tokens are declined for text inference with a shortening message, rather than silently discarding the end. They can still be submitted for review. Top urgency below 0.60 or `UNSPECIFIED` leaves severity unresolved; HIGH is then a stated manual-review queue policy.
- **MiniLM:** mean-pools multilingual token embeddings. Longer reports are split into small chunks and their embeddings averaged. Uses cosine similarity with the existing 200 m/two-hour gates and pHash. The 0.80 similarity threshold is an initial, uncalibrated review policy. At most 20 nearby candidates and 30,000 aggregate characters receive semantic analysis; remaining candidates retain TF-IDF/pHash checks. Missing/failed MiniLM falls back explicitly to lexical matching. The dashboard discloses the model state, method and limits. Confirmation retains evidence and increments counts atomically once.
- **Fusion and hotspots:** preserve the existing explainable policy and DBSCAN. Usable evidence combines 0.8 times text ordinal severity with 0.2 times hand-written image category risk. Verified configured population context can add 0.10. Thresholds 0.25/0.50/0.80 select MEDIUM/HIGH/CRITICAL; usable CRITICAL text is preserved. Text alone can supply severity; image alone cannot. Every pretrained result requires review. Routing is a deterministic suggestion, not a trained dispatch model. Citizen SOS keeps its CRITICAL override. Hotspots describe observed concentration, not forecasts.

## Evaluate on reviewed incident data

Freeze prompts, thresholds and adapter code before testing; use separate validation incidents for development. Do not place the same event in different splits. The supplied historical-disaster ZIP was not used for triage training. Existing dataset CSVs remain header-only templates.

Image manifest: `path,category,split,group_id,source,license`

Text manifest: `title,description,category,priority,split,group_id,source,license`

Categories: FIRE, ACCIDENT, FLOOD, MEDICAL, CRIME, CIVIC. Priorities: LOW, MEDIUM, HIGH, CRITICAL. Image paths are relative to the manifest. Use ignored `datasets/raw/` for evidence. Pretrained evaluation accepts a test-only manifest or a full manifest; test must cover every category and, for text, every priority. Upstream pretraining overlap cannot be ruled out.

From `ml-service`:

```powershell
..\.venv\Scripts\python.exe -m evaluation.evaluate --mode pretrained --kind image --manifest datasets/images.csv
..\.venv\Scripts\python.exe -m evaluation.evaluate --mode pretrained --kind text --manifest datasets/text.csv
```

Metrics are written to `models/evaluation-pretrained/{image,text}/evaluation.json`. The dashboard requires matching upstream and adapter versions. Abstentions remain errors, not discarded samples. It reports actual accuracy, macro precision/recall/F1, per-class results, confusion matrices and measured latency. This evaluates the classifiers, not the complete dispatch policy or duplicate matcher. No test metrics have been generated for this release.

## Optional project-specific training

The original MobileNetV3-Small and TF-IDF/Logistic Regression pipelines remain. They require train/val/test splits, all six categories in each split and all four priorities for text. Group/content leakage checks remain enforced.

```powershell
..\.venv\Scripts\python.exe -m training.train_image --manifest datasets/images.csv --epochs 10
..\.venv\Scripts\python.exe -m training.train_text --manifest datasets/text.csv
..\.venv\Scripts\python.exe -m evaluation.evaluate --mode trained --kind image --manifest datasets/images.csv
..\.venv\Scripts\python.exe -m evaluation.evaluate --mode trained --kind text --manifest datasets/text.csv
$env:ML_MODEL_MODE = 'trained'
```

Restart after switching modes. Trained mode uses trusted local `models/image/model.pt` and `models/text/model.joblib`, original lexical duplicates, and real MobileNet Grad-CAM. Its evaluation artifacts stay separate. Joblib executes serialization: never load untrusted artifacts. Image training downloads the official ImageNet backbone on its first run; inference never downloads.

## Configuration and hosting

| Variable | Purpose |
|---|---|
| `ML_MODEL_MODE` | Python: `pretrained` default, or `trained` |
| `MODEL_DIR` | Python model root; defaults to the service's absolute `models/` path |
| `TORCH_NUM_THREADS` | Python CPU threads; default 2 |
| `ML_SERVICE_URL` | Node's private FastAPI URL |
| `ML_SERVICE_KEY` | Shared private key on both services; never a `VITE_` variable |
| `ML_REQUIRE_KEY` | Require a key at startup; enabled in Docker |
| `ML_TIMEOUT_MS` | Node timeout; 8 seconds default, configurable up to 15 seconds |
| `ML_CONTEXT_ZONES` | Node: reviewed geographic circles; empty means no population assumption |
| `API_PROXY_TARGET` | Optional Vite development Node URL override |

FastAPI reads exported process variables, not `.env.example` automatically. Keep React/Node on the existing Vercel setup. Host FastAPI separately with persistent model storage, HTTPS and a private key. Build Docker from `ml-service`; it downloads the pinned pretrained snapshots into the image. For trained mode, use `DOWNLOAD_PRETRAINED=0` and mount trusted artifacts under `MODEL_DIR`. See [public hosting setup](../docs/ML_HOSTING.md). Use one worker initially. The local process used about 2.3 GiB working memory after inference; this is not a hosting guarantee. Measure peak RAM and latency on the deployment machine. A bounded inference queue returns 503 when busy; Node preserves manual-review fallback.

The public website is deployed on Vercel and connected to the free Gradio ZeroGPU Space `arfaa0312/rapidresq-ml`. Its `space_app.py` entry point uses the same model adapters and policies, with GPU allocation through `spaces.GPU`. GitHub publishes through `.github/workflows/deploy-ml.yml`; no personal Hugging Face token is stored in GitHub. See [hosting setup](../docs/ML_HOSTING.md) for the Gradio transport and private key configuration. Free quotas, queues and cold starts can trigger manual review. The inherited authority UI has no authentication/role enforcement. Use a controlled demonstration environment. The app does not contact official emergency services.

## Checks

Repository root: `npm test` and `npm run check`.

From `ml-service`:

```powershell
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe tests/live_integration.py --base http://127.0.0.1:5000 --mode pretrained
```

The live check requires running Node/FastAPI and refuses remote URLs or persistent storage. Synthetic reports are created only in local memory. Unit fixtures never become runtime weights or project accuracy results.
