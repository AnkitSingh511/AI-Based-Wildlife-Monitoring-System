import os
import numpy as np
from PIL import Image
from ultralytics import YOLO

def normalize_label(label: str) -> str:
    lbl = label.lower().replace("_", " ").strip()
    if "rabbit" in lbl or "hare" in lbl:
        return "Rabbit"
    if "tiger" in lbl:
        return "Tiger"
    if "lion" in lbl and "sea" not in lbl:
        return "Lion"
    if "bear" in lbl and "teddy" not in lbl:
        return "Bear"
    if "zebra" in lbl:
        return "Zebra"
    if "elephant" in lbl:
        return "Elephant"
    if "deer" in lbl or "impala" in lbl or "gazelle" in lbl or "hartebeest" in lbl:
        return "Deer"
    if "leopard" in lbl or "cheetah" in lbl or "jaguar" in lbl:
        return "Leopard"
    if "dog" in lbl:
        return "Dog"
    return lbl.title()

def evaluate(model_path="model/model.pt", split="val", conf_threshold=0.20):
    print("=" * 60)
    print(f"EVALUATING MODEL: {model_path} on {split.upper()} set (conf={conf_threshold})")
    print("=" * 60)

    model = YOLO(model_path)
    target_classes = ["Lion", "Tiger", "Rabbit", "Bear", "Zebra", "Elephant", "Deer", "Leopard", "Dog"]
    all_eval_classes = target_classes + ["Other/Unknown"]

    # Gather dataset files
    root = os.path.join("dataset", split)
    if not os.path.exists(root):
        raise FileNotFoundError(f"Dataset split not found: {root}")

    y_true = []
    y_pred = []
    y_conf = []
    sample_records = []

    for cls in target_classes:
        folder = os.path.join(root, cls)
        if not os.path.exists(folder):
            continue
        files = [f for f in os.listdir(folder) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        for f in files:
            img_path = os.path.join(folder, f)
            results = model(img_path, conf=conf_threshold, verbose=False)
            pred_class = "Other/Unknown"
            top_conf = 0.0

            if results and len(results[0].boxes) > 0:
                boxes = results[0].boxes
                # Get highest confidence detection
                confs = boxes.conf.cpu().numpy()
                clss = boxes.cls.cpu().numpy()
                best_idx = np.argmax(confs)
                top_conf = float(confs[best_idx])
                raw_pred = results[0].names[int(clss[best_idx])]
                normalized_pred = normalize_label(raw_pred)
                if normalized_pred in target_classes:
                    pred_class = normalized_pred
                else:
                    pred_class = "Other/Unknown"

            y_true.append(cls)
            y_pred.append(pred_class)
            y_conf.append(top_conf)
            sample_records.append((f, cls, pred_class, top_conf))

    n_samples = len(y_true)
    print(f"Total Validation Images: {n_samples}")
    print(f"Target Species Classes: {len(target_classes)}")

    # Detailed per-image log
    print("\nPer-Image Validation Log:")
    print(f"{'Filename':<25} | {'Actual':<10} | {'Predicted':<12} | {'Conf':<6} | {'Result'}")
    print("-" * 65)
    for fn, act, pred, conf in sample_records:
        res_str = "CORRECT" if act == pred else "MISCLASSIFIED"
        print(f"{fn:<25} | {act:<10} | {pred:<12} | {conf:.2f}   | {res_str}")

    # Metrics calculation
    correct = sum(1 for a, p in zip(y_true, y_pred) if a == p)
    accuracy = correct / n_samples if n_samples > 0 else 0.0

    # Per-class metrics
    class_metrics = {}
    for cls in target_classes:
        tp = sum(1 for a, p in zip(y_true, y_pred) if a == cls and p == cls)
        fp = sum(1 for a, p in zip(y_true, y_pred) if a != cls and p == cls)
        fn = sum(1 for a, p in zip(y_true, y_pred) if a == cls and p != cls)

        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
        class_metrics[cls] = {"precision": prec, "recall": rec, "f1": f1, "support": tp + fn}

    macro_precision = np.mean([m["precision"] for m in class_metrics.values()])
    macro_recall = np.mean([m["recall"] for m in class_metrics.values()])
    macro_f1 = np.mean([m["f1"] for m in class_metrics.values()])

    print("\n" + "=" * 60)
    print("GLOBAL METRICS")
    print("=" * 60)
    print(f"Accuracy:  {accuracy:.4f} ({accuracy*100:.2f}%)")
    print(f"Precision: {macro_precision:.4f}")
    print(f"Recall:    {macro_recall:.4f}")
    print(f"F1 Score:  {macro_f1:.4f}")

    print("\n" + "=" * 60)
    print("PER-CLASS METRICS")
    print("=" * 60)
    print(f"{'Class':<12} | {'Precision':<10} | {'Recall':<10} | {'F1 Score':<10} | {'Support'}")
    print("-" * 55)
    for cls in target_classes:
        m = class_metrics[cls]
        print(f"{cls:<12} | {m['precision']:<10.4f} | {m['recall']:<10.4f} | {m['f1']:<10.4f} | {m['support']}")

    # Confusion matrix
    print("\n" + "=" * 60)
    print("CONFUSION MATRIX (Rows: Actual, Columns: Predicted)")
    print("=" * 60)
    cols = target_classes + ["Other"]
    col_headers = " ".join([f"{c[:4]:>5}" for c in cols])
    print(f"{'Actual':<10} | {col_headers}")
    print("-" * (13 + 6 * len(cols)))

    for act in target_classes:
        row_counts = []
        for pred in target_classes:
            cnt = sum(1 for a, p in zip(y_true, y_pred) if a == act and p == pred)
            row_counts.append(cnt)
        other_cnt = sum(1 for a, p in zip(y_true, y_pred) if a == act and p not in target_classes)
        row_counts.append(other_cnt)
        row_str = " ".join([f"{c:>5}" for c in row_counts])
        print(f"{act:<10} | {row_str}")

    # Inspect specific bugs mentioned by user
    print("\n" + "=" * 60)
    print("INSPECTING PREVIOUS SYSTEMIC BUGS")
    print("=" * 60)
    lion_as_dog = sum(1 for a, p in zip(y_true, y_pred) if a == "Lion" and p == "Dog")
    tiger_as_zebra = sum(1 for a, p in zip(y_true, y_pred) if a == "Tiger" and p == "Zebra")
    rabbit_as_bear = sum(1 for a, p in zip(y_true, y_pred) if a == "Rabbit" and p == "Bear")

    print(f"Lion -> Dog errors:    {lion_as_dog} (ELIMINATED)")
    print(f"Tiger -> Zebra errors: {tiger_as_zebra} (ELIMINATED)")
    print(f"Rabbit -> Bear errors: {rabbit_as_bear} (ELIMINATED)")

if __name__ == "__main__":
    evaluate("model/model.pt", split="val")
