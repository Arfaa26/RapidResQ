# RapidResQ

Emergency and civic incident reporting with an integrated, trainable ML triage service.

This is the existing **React/Vite + Express** web application from the `web-app` branch. The repository's `main` branch contains a separate Flutter prototype. The citizen interface, authority command center, Leaflet maps, GPS capture, media upload, incident tracking, dispatch status and timelines are preserved.

## ML upgrade status

The application now integrates a separate FastAPI service with:

- MobileNetV3-Small image training/inference, actual softmax probabilities, top-three predictions and optional Grad-CAM.
- TF-IDF + Logistic Regression for text category/priority, real class probabilities and learned feature contributions.
- A documented image/text/context priority policy with explicit SOS override.
- Possible duplicate checks using image pHash, text similarity, GPS distance and report time, followed by authority confirmation.
- DBSCAN hotspot maps and time-window incident trends.
- An evaluation dashboard backed only by held-out test artifacts matching the loaded model version.

**No incident datasets or trained model weights are bundled.** The supplied CSVs contain headers only. Until reviewed datasets are provided and training/evaluation are run, the UI explicitly shows training required/manual review and no fabricated confidence or accuracy. Synthetic software-test models never enter the runtime model directories.

## Architecture

```text
React/Vite -> Node/Express -> Python/FastAPI -> ML models
                  |                  |
                  v                  +-> duplicate comparison / DBSCAN
             Neon PostgreSQL
                  |
                  +-> citizen tracking / authority dashboard
```

Node remains the main API. The browser never calls FastAPI directly or receives its service key. Local development without a database uses the original in-memory demonstration; Vercel requires shared PostgreSQL storage.

## Start locally

1. Install Node 20.19+ (Node 24 tested) and Python 3.13.
2. Run `npm install` in this repository.
3. Create a Python environment and install `ml-service/requirements.txt`.
4. Preserve your existing `backend/.env`; add `ML_SERVICE_URL=http://127.0.0.1:8000` and keep `DATABASE_URL` if configured.
5. From `ml-service`, start `python -m uvicorn app:app --host 127.0.0.1 --port 8000` using that environment.
6. From the repository root, run `npm run dev` and open `http://localhost:3000`.

See the [ML service guide](ml-service/README.md) for exact PowerShell commands, training, test evaluation and deployment configuration.

## Project documentation

- [Architecture audit, file changes, database changes and phase-by-phase plan](docs/ML_UPGRADE.md)
- [Datasets, training, evaluation and service operation](ml-service/README.md)

## Checks

```text
npm test
npm run check
```

Run `python -m pytest -q` from `ml-service` in the Python environment. PostgreSQL grouping tests run locally through PGlite. Existing GPS, incident submission and status regression tests remain.

## Deployment

Keep the existing Vercel frontend and Node API configuration. Deploy FastAPI separately with trained model artifacts, HTTPS and a shared `ML_SERVICE_KEY`, then configure Node's `ML_SERVICE_URL`. The Dockerfile requires a service key and installs CPU PyTorch wheels. Training is never performed in the frontend or during requests.

The inherited authority interface has no authentication/role enforcement. Use a controlled project-demo environment until those controls and real-world ML validation are added. The app does not contact official emergency services.
