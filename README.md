# RapidResQ

Emergency and civic incident reporting with an integrated, trainable ML triage service.

This is the existing **React/Vite + Express** web application from the `web-app` branch. The repository's `main` branch contains a separate Flutter prototype. The citizen interface, authority command center, Leaflet maps, GPS capture, media upload, incident tracking, dispatch status and timelines are preserved.

## ML upgrade status

The application now integrates a separate FastAPI service with:

- SigLIP 2 pretrained photo suggestions and top-three match scores; optional MobileNetV3 training/Grad-CAM retained.
- DeBERTa pretrained English text category/urgency suggestions; optional TF-IDF + Logistic Regression training retained.
- Multilingual MiniLM semantic duplicate matching with explicit lexical fallback and existing geographic/time gates.
- A documented image/text/context priority policy with explicit SOS override.
- Possible duplicate checks using image pHash, text similarity, GPS distance and report time, followed by authority confirmation.
- DBSCAN hotspot maps and time-window incident trends.
- An evaluation dashboard backed only by held-out test artifacts matching the loaded model version.

**The default runtime uses pretrained models, with mandatory authority review and uncalibrated score labels.** The official weights are downloaded separately using the setup command. No RapidResQ-specific training or accuracy is claimed. Missing snapshots show setup required. The supplied historical-disaster CSV is unsuitable for this image/text triage task and was not used for training.

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
5. From `ml-service`, run `python -m pretrained.download` once, then start `python -m uvicorn app:app --host 127.0.0.1 --port 8000` using that environment.
6. From the repository root, run `npm run dev` and open `http://localhost:3000`.

See the [ML service guide](ml-service/README.md) for exact PowerShell commands, training, test evaluation and deployment configuration.

## Project documentation

- [Current features, integrated model links and remaining limitations](docs/CURRENT_FEATURES.md). Model metrics are now under **Developer -> ML Evaluation**; the authority dashboard keeps Incidents and Hotspot Analytics.

- [Architecture audit, file changes, database changes and phase-by-phase plan](docs/ML_UPGRADE.md)
- [Datasets, training, evaluation and service operation](ml-service/README.md)

## Checks

```text
npm test
npm run check
```

Run `python -m pytest -q` from `ml-service` in the Python environment. PostgreSQL grouping tests run locally through PGlite. Existing GPS, incident submission and status regression tests remain.

## Deployment

The existing Vercel website is connected to the free [RapidResQ ML Space](https://huggingface.co/spaces/arfaa0312/rapidresq-ml). All three models, public photo/text previews and hotspot analytics were verified. GitHub Actions publishes model source using a repository-scoped trusted publisher. See [public hosting](docs/ML_HOSTING.md) for `ML_SERVICE_TRANSPORT=gradio`, the private service key and deployment details. Free ZeroGPU hosting has quotas, queues and cold starts; manual-review fallback remains. FastAPI/Docker are retained for local or alternative hosting. Training is never performed in the frontend or during requests.

The inherited authority interface has no authentication/role enforcement. Use a controlled project-demo environment until those controls and real-world ML validation are added. The app does not contact official emergency services.

## Fresh location reporting

The browser requests high-accuracy, uncached device positions and keeps the map updated from a shared live watch. Normal report submission accepts a reading at most 15 seconds old. If needed, acquisition waits up to ten seconds for a fix within 50 m; otherwise it sends the best fresh observation with its actual estimated accuracy. Coordinates retain the device precision and original timestamp. Malformed or unavailable readings never become an invented location.

The home/report screens display capture age, estimated uncertainty and coordinates. The map retains its accuracy circle. SOS uses a fresh observation promptly and may fall back to an explicitly timestamped reading up to five minutes old if refresh fails, but never after permission denial. A browser cannot guarantee GPS-level accuracy on hardware without a good location signal.

Validation after this change: 29 Node/GPS/API/PostgreSQL/formatting tests passed; frontend lint, production build and backend build passed. The unchanged Python suite previously passed 21 tests. Added GPS tests cover movement, stale-cache avoidance, refinement, coarse-signal deadlines, permission denial and invalid device data. Physical phone GPS accuracy still requires a test on the user's device.
