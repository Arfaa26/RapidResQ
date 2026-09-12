# Validation record

Validated locally on 12 September 2026 against the existing React web-app based on commit 23864c3.

| Check | Result |
|---|---|
| Frontend lint and production build | Passed |
| Express/TypeScript build | Passed |
| Node, GPS, API, PostgreSQL and score-formatting tests | 24 passed |
| Python ML, training, evaluation and pretrained-policy tests | 21 passed |
| Three official pretrained snapshots | Downloaded, revision-pinned and loaded successfully |
| Local Node to FastAPI HTTP workflow with real pretrained weights | Passed |
| Browser checks | Citizen text preview, authority prediction/duplicate details, ready-model evaluation panels checked |
| Domain accuracy | Not measured; no suitable labeled test dataset supplied |

The HTTP workflow sent a synthetic image and text through the existing Node preview and submission endpoints to actual SigLIP 2 and DeBERTa inference. It checked genuine normalized scores, explicit uncalibrated provenance, mandatory review, local incident persistence, real MiniLM duplicate scoring, authority confirmation, idempotent counts, retained media, grouped citizen status, the hotspot API and an evaluation page with no fabricated metrics. The initial MiniLM tokenizer mismatch found by this test was corrected, and the workflow passed on rerun.

A separate synthetic text check for a person unconscious and not breathing returned MEDICAL/CRITICAL through DeBERTa and the existing policy in about 1.7 seconds on this machine. This single example is a functionality observation, not emergency accuracy. A separate paraphrase comparison did not cross the initial 0.80 duplicate threshold; real held-out tuning is still required. Do not advertise guaranteed paraphrase recall.

The Python suite also retains the original isolated MobileNet/Grad-CAM and fitted Logistic Regression checks, leakage checks, DBSCAN and training/evaluation tests. Added tests cover missing pretrained snapshots without network access, uncertainty, mandatory authority review, bounded semantic candidates and explicit failure fallback. Test fixtures never become runtime weights or project accuracy.

The local process used approximately 2.3 GiB working memory after inference. Cold startup takes longer than an individual prediction. Hosting requirements and production latency must be measured on the actual host. Text triage currently supports English; multilingual capability is used for duplicate embeddings. SigLIP heatmaps are explicitly unsupported.

No hosted Neon changes, GitHub push, Vercel deployment, public ML hosting, Docker build, comprehensive visual regression, operational emergency validation or production load test was performed. Database behavior was checked locally using PGlite. The inherited lack of authority authentication remains a limitation for public operation. The local preview uses demonstration/test records only.

## Fresh location reporting

The browser requests high-accuracy, uncached device positions and keeps the map updated from a shared live watch. Normal report submission accepts a reading at most 15 seconds old. If needed, acquisition waits up to ten seconds for a fix within 50 m; otherwise it sends the best fresh observation with its actual estimated accuracy. Coordinates retain the device precision and original timestamp. Malformed or unavailable readings never become an invented location.

The home/report screens display capture age, estimated uncertainty and coordinates. The map retains its accuracy circle. SOS uses a fresh observation promptly and may fall back to an explicitly timestamped reading up to five minutes old if refresh fails, but never after permission denial. A browser cannot guarantee GPS-level accuracy on hardware without a good location signal.

Validation after this change: 29 Node/GPS/API/PostgreSQL/formatting tests passed; frontend lint, production build and backend build passed. The unchanged Python suite previously passed 21 tests. Added GPS tests cover movement, stale-cache avoidance, refinement, coarse-signal deadlines, permission denial and invalid device data. Physical phone GPS accuracy still requires a test on the user's device.
