import os
import sys
from PIL import Image
from ultralytics import YOLO

# Add parent directory to sys.path so detect functions can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from detect import load_model, detect_wildlife, validate_image

def run_wildlife_test_pipeline():
    model, is_custom_model = load_model()

    test_cases = [
        ("Lion", "tests/benchmark/lion.jpg"),
        ("Tiger", "tests/benchmark/tiger.jpg"),
        ("Rabbit", "tests/benchmark/rabbit_test.jpg"),
        ("Bear", "dataset/test/Bear/bear_2.jpg"),
        ("Zebra", "tests/benchmark/zebra.jpg"),
        ("Elephant", "tests/benchmark/elephant.jpg"),
        ("Deer", "dataset/test/Deer/deer_2.jpg"),
        ("Dog", "dataset/test/Dog/dog_2.jpg"),
    ]

    print("\nRunning Automated Wildlife Detection Pipeline Test...")
    print(f"Model: {model.model.__class__.__name__ if hasattr(model, 'model') else 'YOLO'}")
    print(f"Custom Model Mode: {is_custom_model}\n")

    table_sep = "+----------+----------------+----------------+------------+"
    header    = "| Actual   | Predicted      | Confidence     | Result     |"

    print(table_sep)
    print(header)
    print(table_sep)

    all_passed = True

    for actual_species, img_path in test_cases:
        if not os.path.exists(img_path):
            print(f"| {actual_species:<8} | FILE NOT FOUND | 0.00           | FAIL       |")
            all_passed = False
            continue

        img = validate_image(img_path)
        detections = detect_wildlife(model, is_custom_model, img)

        if not detections:
            predicted_species = "Unknown"
            conf = 0.0
        else:
            primary = detections[0]
            conf = primary["confidence"]
            predicted_species = primary["species"] if conf >= 0.40 else "Unknown"

        result = "CORRECT" if predicted_species.lower() == actual_species.lower() else "INCORRECT"
        if result != "CORRECT":
            all_passed = False

        print(f"| {actual_species:<8} | {predicted_species:<14} | {conf:<14.2f} | {result:<10} |")

    print(table_sep)
    print(f"\nOverall Pipeline Result: {'PASSED (ALL SPECIES CORRECT)' if all_passed else 'SOME TESTS FAILED'}\n")
    return all_passed

if __name__ == "__main__":
    success = run_wildlife_test_pipeline()
    sys.exit(0 if success else 1)
