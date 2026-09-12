# Validation record

Validated locally on 12 September 2026 against the existing `web-app` application based on commit `23864c3`.

| Check | Result |
|---|---|
| Frontend lint | Passed, no warnings |
| React/Vite production build | Passed |
| Express/TypeScript build | Passed |
| Node/GPS/API/PostgreSQL suite | 22 tests passed |
| Python ML/training/evaluation suite | 14 tests passed |
| Local Node -> FastAPI HTTP workflow | Passed |
| Whitespace/diff check | Passed |
| Runtime artifact directories | Empty except `.gitkeep`; no test models shipped |

The original 14 regression tests remain. New checks cover missing and malformed ML responses, probability provenance, geographic context, legacy confidence display, duplicate confirmation/rejection, atomic/idempotent PostgreSQL counts and grouped tracking. The Python suite covers real estimator probability computation, MobileNet forward/Grad-CAM, missing/corrupt models and images, upload limits, service authentication, feature extraction, split leakage checks, DBSCAN and separate training/evaluation artifact creation.

The live workflow sent a generated image fixture through the existing Node preview/submission endpoints to FastAPI, saved reports to the local in-memory store, found a possible duplicate, confirmed it, verified the count only increased once, retrieved the retained attachment and followed the primary incident's status from the grouped citizen report. Evaluation correctly returned no metrics for the untrained models, and hotspot analysis remained available without trained classifiers.

Synthetic data/models are used only as isolated software-test fixtures. Their metrics are not reported as RapidResQ accuracy. No real incident training dataset, domain-trained checkpoint, real-world benchmark or verified population dataset was supplied. The final application displays this honestly.

Not performed: browser interaction/visual regression testing, Docker image build, hosted Neon verification, multi-host load testing, GitHub push, Vercel deployment or public FastAPI deployment. PostgreSQL queries were executed locally in PGlite; the existing production Neon connection was not changed. The inherited lack of authority authentication remains a deployment limitation.
