"""Run from ml-service: python -m training.train_image --manifest datasets/images.csv"""
import argparse
import copy
from pathlib import Path
from uuid import uuid4
import torch
from PIL import Image, ImageOps
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from sklearn.metrics import f1_score
from image_model.model import architecture, TRANSFORM
from schemas import CATEGORIES
from training.data import read_manifest, metadata


class Images(Dataset):
    def __init__(self, rows, training=False):
        self.rows = rows
        self.transform = transforms.Compose([
            transforms.RandomResizedCrop(224, scale=(.8, 1.)), transforms.RandomHorizontalFlip(),
            transforms.ToTensor(), transforms.Normalize([.485, .456, .406], [.229, .224, .225])
        ]) if training else TRANSFORM

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index):
        row = self.rows[index]
        with Image.open(row['absolute_path']) as image:
            tensor = self.transform(ImageOps.exif_transpose(image).convert('RGB'))
        return tensor, CATEGORIES.index(row['category'])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--output', default='models/image')
    parser.add_argument('--epochs', type=int, default=10)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--threads', type=int, default=2)
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1:
        parser.error('Epochs and batch size must be positive')
    torch.manual_seed(42)
    torch.set_num_threads(args.threads)
    rows, fingerprint = read_manifest(args.manifest, 'image')
    train = [r for r in rows if r['split'] == 'train']
    val = [r for r in rows if r['split'] == 'val']
    model = architecture(pretrained=True)
    for parameter in model.features.parameters():
        parameter.requires_grad_(False)
    optimizer = torch.optim.AdamW(model.classifier.parameters(), lr=.001)
    counts = torch.tensor([sum(r['category'] == c for r in train) for c in CATEGORIES], dtype=torch.float)
    loss_fn = torch.nn.CrossEntropyLoss(weight=counts.sum() / (len(CATEGORIES) * counts))
    train_loader = DataLoader(Images(train, True), batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(Images(val), batch_size=args.batch_size)
    best_score, best_weights = -1., None
    for epoch in range(args.epochs):
        model.train()
        model.features.eval()  # Frozen pretrained batch-normalization statistics.
        for images, labels in train_loader:
            optimizer.zero_grad()
            loss = loss_fn(model(images), labels)
            loss.backward()
            optimizer.step()
        model.eval()
        actual, predicted = [], []
        with torch.inference_mode():
            for images, labels in val_loader:
                predicted.extend(model(images).argmax(1).tolist())
                actual.extend(labels.tolist())
        score = float(f1_score(actual, predicted, average='macro', zero_division=0))
        print(f'Epoch {epoch+1}: validation macro F1={score:.4f}', flush=True)
        if score > best_score:
            best_score, best_weights = score, copy.deepcopy(model.state_dict())
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    meta = metadata(rows, fingerprint, 'mobilenetv3-' + uuid4().hex[:12], 'MobileNetV3-Small transfer learning')
    meta.update({'epochs': args.epochs, 'seed': 42, 'validationMacroF1': best_score})
    torch.save({'state_dict': best_weights, 'metadata': meta}, output / 'model.pt')
    print(f'Saved trained classifier to {output}. Test evaluation must be run separately.')


if __name__ == '__main__':
    main()
