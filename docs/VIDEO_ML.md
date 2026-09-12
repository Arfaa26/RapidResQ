# Photo, video and event-model work

RapidResQ accepts photos and short MP4/MOV/WebM clips. Videos are limited to 4 MB, 30 seconds and 1080p for this free deployment. The original uploaded clip remains evidence. PyAV extracts up to six timestamped frames in an isolated local decoding process with resource and time limits. SigLIP 2 classifies the sampled scenes; differing or unclear frame results require review. Brief events between samples can be missed. There is no audio analysis, motion tracking, or claim of trained action recognition from frame sampling.

YOLOX-Nano adds COCO person/vehicle evidence for photos and sampled video frames. Its CPU ONNX export is downloaded from the official release and verified with a pinned SHA-256. Per-frame detections are not unique person counts and do not prove an accident, violence, a medical condition or severity. `THIRD_PARTY_NOTICES.md` records attribution.

## Optional supervised video pipeline

The requested UCF-Crime / XD-Violence plan is supported by a modular video manifest and training path:

```text
training/prepare_ucf.py    official UCF lists + local footage -> reviewed manifest
training/video_data.py    labels, duplicate/content and source-group split checks
training/extract_video.py six ordered SigLIP scene-score vectors per source video
training/train_video.py   event + anomaly GRU heads; validation selection and test evaluation
video/temporal.py         load compatible evaluated artifacts; otherwise training_required
```

This is an experimental small GRU over scene scores, not a large pretrained temporal video network. It requires NORMAL and incident examples in every split. Whole-video weak labels are never assigned to individual frames. All derivatives of a source video must remain in one split. Sparse sampling of long untrimmed videos can miss the anomalous segment; this baseline needs suitable event clips and validation before operational use.

Run from `ml-service` after obtaining permitted footage and the official lists:

```powershell
..\.venv\Scripts\python.exe -m training.prepare_ucf --root datasets/raw/UCF --train-list datasets/raw/train.txt --test-list datasets/raw/test.txt --permission "actual permission reference" --output datasets/videos.csv
..\.venv\Scripts\python.exe -m training.extract_video --manifest datasets/videos.csv --output datasets/features/video
..\.venv\Scripts\python.exe -m training.train_video --manifest datasets/videos.csv --features datasets/features/video
```

The general CSV schema is `path,event,split,group_id,source,license`. Supported event labels are NORMAL, FIRE, ACCIDENT, EXPLOSION, VIOLENCE, FLOOD, MEDICAL, OTHER. Unsupported classes are not invented. Arrest videos are excluded from the automatic UCF mapping: an arrest is not proof of a crime. UCF does not supply flood/medical coverage or RapidResQ urgency labels.

No UCF/XD training completion is claimed. The official UCF archive download failed TLS certificate validation from this environment. No certificate bypass or unverified mirror was used. The supervised temporal model therefore stays `training_required`; the deployed video feature is actual pretrained frame analysis. The MEDIC image training is a separate workflow and does not make this a trained temporal model.

Official sources:

- UCF-Crime: https://www.crcv.ucf.edu/research/real-world-anomaly-detection-in-surveillance-videos/
- XD-Violence: https://roc-ng.github.io/XD-Violence/
- VIRAT: https://viratdata.org/
- YOLOX: https://github.com/Megvii-BaseDetection/YOLOX

Additional XD-Violence, fire, flood and permitted citizen-footage stages remain dataset-specific preparation work. Their access terms and labels must be checked before inclusion. The current HIGH/CRITICAL policy is not trained from those datasets. P1/P2/P3/P4 are displayed aliases for CRITICAL/HIGH/MEDIUM/LOW, with citizen SOS preserving P1.
