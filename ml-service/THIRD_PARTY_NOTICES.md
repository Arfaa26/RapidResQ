# Dataset and model attribution

## MEDIC

MEDIC: A Multi-Task Learning Dataset for Disaster Image Classification.
Firoj Alam, Tanvirul Alam, Md. Arid Hasan, Abul Hasnat, Muhammad Imran, Ferda Ofli.
Neural Computing and Applications 35(3):2609–2632, 2023.
Paper: https://arxiv.org/abs/2108.12828
Dataset: https://crisisnlp.qcri.org/medic/
Official QCRI mirror: https://huggingface.co/datasets/QCRI/MEDIC
License: CC BY-NC-SA 4.0. Non-commercial research use; preserve attribution and share-alike requirements.
The dataset card describes CC BY-NC-SA 4.0 but one prose hyperlink points to BY-NC;
RapidResQ follows the supplied BY-NC-SA legalcode file and repository license metadata.
Terms: https://crisisnlp.qcri.org/medic/terms-of-use.html
No source disaster images are included in the app or public model deployment.
The MEDIC-derived model release carries CC BY-NC-SA 4.0 attribution/license information.

Also cite the constituent dataset papers as requested by the authors:

- Alam et al., Deep Learning Benchmarks and Datasets for Social Media Image Classification for Disaster Response, ASONAM 2020.
- Alam, Ofli and Imran, CrisisMMD: Multimodal Twitter Datasets from Natural Disasters, ICWSM 2018.
- Mouzannar, Rizk and Awad, Damage Identification in Social Media Posts using Multimodal Deep Learning, ISCRAM 2018.
- Nguyen, Ofli, Imran and Mitra, Damage assessment from social media imagery data during disasters, ASONAM 2017.

## YOLOX

YOLOX-Nano, Copyright Megvii, Inc. and contributors, Apache License 2.0.
Official project: https://github.com/Megvii-BaseDetection/YOLOX
License: https://github.com/Megvii-BaseDetection/YOLOX/blob/main/LICENSE
Official ONNX export release: 0.1.1rc0, yolox_nano.onnx.
The checksum and download URL are pinned in detector/model.py. Used for COCO person/vehicle evidence only.

## Existing pretrained models and backbone

- MobileNetV3-Small ImageNet-1K weights: torchvision, https://pytorch.org/vision/stable/models/mobilenetv3.html.
- SigLIP 2: https://huggingface.co/google/siglip2-base-patch16-224.
- DeBERTa zero-shot: https://huggingface.co/MoritzLaurer/deberta-v3-base-zeroshot-v2.0.
- Multilingual MiniLM: https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2.

Existing Hugging Face snapshots retain their upstream model cards and licenses. No RapidResQ domain accuracy is implied by their published benchmarks.
