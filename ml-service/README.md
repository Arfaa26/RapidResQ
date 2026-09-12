# RapidResQ ML service

Models are **not trained** in the delivered source. The dataset CSVs are empty templates. Until real datasets are supplied and training is run, the service returns `training_required` and null confidence. It still supports pHash duplicate checks and DBSCAN.

## Local setup (PowerShell, from the repository root)

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ml-service/requirements.txt
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

If a backend `.env` already exists, preserve it and add the ML settings manually. Retain the existing `DATABASE_URL` for persistent reports. Do not commit secrets. The `.env.example` files are templates; FastAPI reads exported process variables, not these files automatically.

Terminal 1:

```powershell
cd ml-service
..\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Terminal 2, repository root:

```powershell
npm run dev
```

The app is at `http://localhost:3000`. Node is at `http://localhost:5000`, and calls the configured FastAPI URL. Set `ML_SERVICE_URL=http://127.0.0.1:8000` in `backend/.env`. Models are loaded once during FastAPI startup; restart after training. No model download occurs during inference.

## Dataset manifests

`datasets/images.csv` columns:

```text
path,category,split,group_id,source,license
```

Image paths are relative to the manifest directory. Supply the six categories FIRE, ACCIDENT, FLOOD, MEDICAL, CRIME, CIVIC. Use `raw/` for local image files; that directory is ignored by Git.

`datasets/text.csv` columns:

```text
title,description,category,priority,split,group_id,source,license
```

Priority labels are LOW, MEDIUM, HIGH, CRITICAL. Split labels are train, val, test. Use a stable incident/event identifier as `group_id`; the same event must never cross splits. Source and license are required. Include all six categories in each split and all four priorities in every text split. Split by event before augmentation. See `../docs/ML_UPGRADE.md` for sources and labeling limitations.

## Train (from ml-service)

```powershell
$env:TORCH_HOME = (Join-Path (Get-Location) '.torch-cache')
..\.venv\Scripts\python.exe -m training.train_image --manifest datasets/images.csv --epochs 10
..\.venv\Scripts\python.exe -m training.train_text --manifest datasets/text.csv
```

Image training downloads the official pretrained MobileNetV3-Small backbone on its first run, freezes its feature extractor and trains a six-class head. Validation macro F1 selects the checkpoint. Text training selects regularization on the validation split. The commands fail clearly on empty/invalid datasets, instead of creating placeholder models.

Output:

```text
models/image/model.pt
models/text/model.joblib
```

Load only trusted locally produced artifacts, especially joblib files. Training code is never executed inside React or during API requests.

## Evaluate on held-out test records

```powershell
..\.venv\Scripts\python.exe -m evaluation.evaluate --kind image --manifest datasets/images.csv
..\.venv\Scripts\python.exe -m evaluation.evaluate --kind text --manifest datasets/text.csv
```

These create `models/image/evaluation.json` and `models/text/evaluation.json`. The dashboard shows results only when the artifact's model version matches the loaded trained model. Training/validation scores are not presented as test accuracy. Latency is measured per sample on the evaluation CPU, including preprocessing but excluding network time. The first sample can include warmup effects.

Open **Authority Command Center → ML Evaluation** after restarting the ML service. The evaluation includes category metrics and, for text, separate priority metrics.

## Demo workflow

1. Start Node, React and FastAPI; verify `/api/ml/status`.
2. Open the reporting screen, upload a photo and enter a description. Select a category only if known.
3. Enable Grad-CAM if needed. Trained models show actual probabilities; otherwise the interface states what is unavailable.
4. Allow GPS and submit. The report appears in the existing authority queue and map.
5. Submit a similar report nearby. Inspect both reports and confirm/reject the possible duplicate.
6. Open Hotspot Analytics. Use actual independent reports; a cluster needs at least three within the configured neighborhood. Seeded demo records do not count.
7. Open ML Evaluation to show the held-out results, or honestly demonstrate the training-required state.

## Configuration

| Variable | Used by | Meaning |
|---|---|---|
| `ML_SERVICE_URL` | Node | FastAPI base URL |
| `ML_SERVICE_KEY` | Both | Shared private service key |
| `ML_TIMEOUT_MS` | Node | Request timeout; default 8 seconds, capped at 15 seconds |
| `ML_CONTEXT_ZONES` | Node | JSON array of reviewed geographic circles; empty by default |
| `MODEL_DIR` | Python | Parent of image/text artifact directories; default service `models/` |
| `TORCH_NUM_THREADS` | Python | CPU threads; default 2 |
| `ML_REQUIRE_KEY` | Python | Set to 1 to reject startup without a key; enabled in Docker |
| `API_PROXY_TARGET` | Vite development | Optional override of local Node URL |

A context zone requires numeric `lat`, `lng`, `radiusMeters`, `populatedArea: true`, and a nonempty `source` naming a reviewed dataset. Do not label coordinates populated without supporting data. No zones or population dataset are bundled.

## Deployment

Keep React/Node on the existing Vercel setup. FastAPI requires a separate Python process or container; it is not included in the Vite static build or Node serverless function. The Dockerfile uses CPU wheels and requires `ML_SERVICE_KEY` at startup. Build from the `ml-service` directory; include trained `models/` or mount a read-only directory and set `MODEL_DIR`. Use one worker initially and measure CPU/RAM requirements with actual images. Configure HTTPS and the same private key on Node and FastAPI. Set Vercel's Node environment variables and redeploy only after verifying service health.

No model-training results or external infrastructure are provisioned by the source upgrade. The inherited app has no authority authentication and is suitable for controlled project demonstrations until access controls are added.

## Checks

From the repository root:

```powershell
npm test
npm run check
```

From `ml-service`:

```powershell
..\.venv\Scripts\python.exe -m pytest -q
```

Optional, with Node/ML running in local demo mode:

```powershell
..\.venv\Scripts\python.exe tests/live_integration.py --base http://127.0.0.1:5000
```

The HTTP check refuses remote/persistent storage and creates labeled synthetic software-test reports locally. The unit/training tests create models only in temporary test directories. Their scores are not project accuracy results.
