# MEDIC in RapidResQ

MEDIC is the primary **disaster image** dataset. Its official name is *MEDIC: A Multi-Task Learning Dataset for Disaster Image Classification*. It does not label emergency dispatch priority, accidents, medical conditions, or crime. Existing text analysis, GPS, duplicate review, incident storage and authority workflows remain in use.

## Source and access

- Authors' project: https://crisisnlp.qcri.org/medic/
- Official QCRI distribution: https://huggingface.co/datasets/QCRI/MEDIC
- Pinned revision: `bc2e6f3c99f511ce89055cad5a661c69e43ec6de`
- Source repository: https://github.com/firojalam/medic
- Terms: https://crisisnlp.qcri.org/medic/terms-of-use.html
- License: **CC BY-NC-SA 4.0**, for non-commercial research. Retain attribution and share-alike terms. The supplied legalcode takes precedence over an inconsistent shorter license hyperlink in the dataset card.
- Attribution and constituent dataset citations: `ml-service/THIRD_PARTY_NOTICES.md`.

The full official snapshot contains 71,198 rows, with 49,353 train, 6,157 development, and 15,688 test images before cleanup. The parquet download is approximately 10.94 GB. No account token or paid hosting is needed to access this public dataset.

## Structure

```text
ml-service/
  datasets/medic/config.json             # Source, revision, labels, threshold
  datasets/medic/raw/                    # Ignored: official parquet files/license
  datasets/medic/processed/              # Ignored: validated resized images
  datasets/medic/manifest.csv            # Ignored: cleaned official splits
  datasets/medic/preprocessing.json      # Ignored: cleanup audit and class counts
  training/download_medic.py
  training/prepare_medic.py
  training/train_medic.py
  medic/model.py                        # Model, probability inference, routing adapter
  inference/predict_image.py             # Standalone inference
  models/disaster_classifier/            # Ignored: locally trained model and evaluation
  artifacts/medic/                       # Only verified release weights/metadata/license
```

Dataset-specific preparation is separate from the image classifier and HTTP adapter. Another dataset can supply a reviewed compatible manifest or its own label adapter without changing the citizen or authority pages. Do not silently mix datasets with incompatible labels or permissions.

## Labels and compatibility

The official `disaster_types` feature order is verified against parquet metadata, rather than guessed from an example:

| ID | MEDIC label | Displayed incident type | Existing routing category |
|---|---|---|---|
| 0 | earthquake | Earthquake | HAZARD, authority verifies department |
| 1 | flood | Flood | FLOOD |
| 2 | hurricane | Storm/Hurricane | HAZARD, authority verifies department |
| 3 | fire | Fire | FIRE |
| 4 | landslide | Landslide | HAZARD, authority verifies department |
| 5 | not_disaster | Normal | HAZARD / review; never automatically dismiss |
| 6 | other_disaster | Other Emergency | HAZARD, authority verifies department |

The exact MEDIC type and seven model probabilities are preserved in `incident.aiAnalysis.disaster`. The existing broad `incident.category` and department contracts stay compatible. A “Normal” image does not rule out a medical, crime, or other emergency. Missing/low-confidence visual evidence cannot establish a low priority.

## Preparation and training

Run from `ml-service` using the repository's Python environment:

```powershell
..\.venv\Scripts\python.exe -m pip install -r requirements-training.txt
..\.venv\Scripts\python.exe -m training.download_medic
..\.venv\Scripts\python.exe -m training.prepare_medic
..\.venv\Scripts\python.exe -m training.train_medic
```

Preparation fully decodes images; rejects corrupt, tiny and decompression-limit images; applies EXIF orientation and RGB conversion; and stores a maximum 512-pixel side JPEG. It deduplicates exact SHA-256 and identical perceptual hashes. On overlap, holdout precedence is test, then validation, then train. Conflicting duplicate labels are excluded. Images are not randomly moved out of the official test split. Similar images with different hashes may remain, and the official split is not a guarantee of unseen disaster events.

Training uses **MobileNetV3-Small ImageNet-1K features with a genuinely trained 576-to-7 linear softmax classifier**. The backbone stays frozen. Inputs use torchvision's resize-to-256, center-crop-to-224, and ImageNet normalization. Feature normalization is fitted on train only. Class-weighted cross-entropy addresses imbalance. Validation macro F1 selects the classifier; validation-only temperature scaling adjusts confidence. The test set is used only after model selection. This is transfer learning, not training every backbone layer from scratch.

The model, metadata and evaluation are saved separately in `models/disaster_classifier`. The loader checks the weight checksum, label order, training provenance and matching test evaluation. Random or incomplete artifacts never produce a model-ready response.

## Inference and app connection

```powershell
..\.venv\Scripts\python.exe -m inference.predict_image --image C:\path\to\photo.jpg
```

On a new source checkout, first run `python -m medic.install` from `ml-service` to install the released model without downloading the dataset.

For a configurable threshold, set `MEDIC_CONFIDENCE_THRESHOLD` in the ML service environment (default `0.70`, valid range greater than zero and at most one).

The Python API accepts `POST /predict-image` with multipart `media`, subject to the existing 4 MB limit and `X-ML-Service-Key` authentication when configured. The hosted Gradio adapter exposes the equivalent private service operation `/predict-image` through `dispatch`.

Responses include `incidentType`, actual model `confidence`, `dataset: MEDIC`, `model: RapidResQ Disaster Classifier`, model version, threshold, seven probabilities, and review status. Below threshold, `incidentType` is null and the message is **“Low confidence — Manual verification required.”** No confidence is hardcoded.

The existing citizen photo flow is:

```text
Photo upload -> /api/ai/preview -> authenticated Python /analyze
             -> MEDIC prediction + optional text analysis + object evidence
             -> citizen preview -> /api/incidents
             -> existing JSON incident storage -> authority/citizen details
```

MEDIC runs on CPU on the free ML host. If shared GPU text inference fails, the real MEDIC photo prediction is retained and urgency returns to explicit manual review. When MEDIC artifacts are missing, its status is explicit and the existing general scene model may provide separately identified assistance. The MEDIC model is never downloaded to the browser.

## Verified preprocessing run

The pinned 71,198-row snapshot produced **63,194 cleaned images**: 41,551 train, 6,089 validation and 15,554 test. The audit excluded 7,153 duplicate records and 106 invalid/oversized/tiny images, then removed 745 previously retained rows belonging to conflicting-label duplicate groups. The 1,505 conflicting duplicate encounters are a subset of duplicate processing, not an additional exclusion count.

All seven classes remain in every split. The full per-class counts and exclusions are saved in `datasets/medic/preprocessing.json`.

## Evaluation and release

The authoritative results are `models/disaster_classifier/evaluation.json` and its verified release copy. They include accuracy, macro precision/recall/F1, per-class support, confusion matrix, low-confidence count, coverage and accepted-prediction accuracy. Raw top-class accuracy and above-threshold accuracy are distinct. Results on MEDIC do not establish accuracy on citizen uploads or urgency assessment.

Only verified model weights, metadata, evaluation, and license are packaged into the ML deployment. Raw parquet files, processed images, feature caches and manifests are excluded from Git, Vercel, the Hugging Face Space, and the frontend. Developer evaluation displays the metrics matching the loaded MEDIC model.
