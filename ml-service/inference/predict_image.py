"""python -m inference.predict_image --image <path> --model-dir models/disaster_classifier"""
import argparse
import json
import torch
from PIL import Image, ImageOps
from medic.model import MedicClassifier


def predict_image(path, model_dir='models/disaster_classifier'):
    torch.set_num_threads(2)
    classifier = MedicClassifier(model_dir)
    with Image.open(path) as image:
        return classifier.predict(ImageOps.exif_transpose(image).convert('RGB'))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', required=True)
    parser.add_argument('--model-dir', default='models/disaster_classifier')
    args = parser.parse_args()
    print(json.dumps(predict_image(args.image, args.model_dir), indent=2))
