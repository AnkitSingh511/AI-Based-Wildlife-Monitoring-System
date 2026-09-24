import os
import hashlib
from PIL import Image

def verify_dataset():
    root = 'dataset'
    splits = ['train', 'val', 'test']
    classes = ['Lion', 'Tiger', 'Rabbit', 'Bear', 'Zebra', 'Elephant', 'Deer', 'Leopard', 'Dog']

    print('==================================================')
    print('DATASET AUDIT & INTEGRITY VERIFICATION')
    print('==================================================')

    hashes = {}
    leaks = []
    corrupted = []
    stats = {c: {'train': 0, 'val': 0, 'test': 0} for c in classes}

    for split in splits:
        for cls in classes:
            folder = os.path.join(root, split, cls)
            if not os.path.exists(folder):
                continue
            files = [f for f in os.listdir(folder) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
            stats[cls][split] = len(files)
            for f in files:
                path = os.path.join(folder, f)
                try:
                    with Image.open(path) as img:
                        img.verify()
                except Exception as e:
                    corrupted.append((path, str(e)))
                    continue

                with open(path, 'rb') as fp:
                    h = hashlib.md5(fp.read()).hexdigest()
                if h in hashes:
                    prev_split, prev_cls, prev_path = hashes[h]
                    if prev_split != split or prev_cls != cls:
                        leaks.append((path, prev_path))
                else:
                    hashes[h] = (split, cls, path)

    print(f'Corrupted files: {len(corrupted)}')
    if corrupted:
        for c in corrupted:
            print(f'  Corrupt: {c}')

    print(f'Data leakage / duplicates across splits: {len(leaks)}')
    if leaks:
        for l in leaks:
            print(f'  Duplicate/Leak: {l}')

    print('\n==================================================')
    print('DATASET SUMMARY TABLE')
    print('==================================================')
    header = f'{"Class":<12} | {"Train Images":<12} | {"Validation Images":<18} | {"Test Images":<12}'
    print(header)
    print('-' * len(header))
    total_train = total_val = total_test = 0
    for cls in classes:
        tr = stats[cls]['train']
        va = stats[cls]['val']
        te = stats[cls]['test']
        total_train += tr
        total_val += va
        total_test += te
        print(f'{cls:<12} | {tr:<12} | {va:<18} | {te:<12}')
    print('-' * len(header))
    print(f'{"TOTAL":<12} | {total_train:<12} | {total_val:<18} | {total_test:<12}')

if __name__ == '__main__':
    verify_dataset()
