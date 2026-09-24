#!/usr/bin/env python3
"""
python/detect.py
----------------
AI/ML wildlife image detection service using PyTorch / YOLO.
Invoked by Node.js backend via child process spawning.

The script runs genuine PyTorch inference:
1. Validates and preprocesses the uploaded image.
2. Loads trained PyTorch YOLO model ('model/model.pt' or 'model/yolov8n.pt').
3. Runs forward inference on the image tensor.
4. Identifies detected animal/wildlife species, bounding boxes, and confidence scores.
5. If no wildlife is detected, exits with a clear error payload.
6. Returns JSON adhering to the exact required schema.
"""

import sys
import os
import json
import datetime
import warnings

# Suppress library warnings so standard output contains only clean JSON
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"
os.environ["YOLO_VERBOSE"] = "False"

from PIL import Image, ImageOps
import torch
from ultralytics import YOLO

# Recognized animal and wildlife classes (COCO animal classes + sanctuary wildlife)
KNOWN_ANIMAL_CLASSES = {
    # COCO dataset animal classes (mapped directly to their actual names - NO fake mappings)
    "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe",
    # Wildlife sanctuary target species supported by custom wildlife models
    "tiger", "leopard", "cheetah", "lion", "jaguar", "panther", "lynx",
    "deer", "antelope", "gazelle", "elk", "moose", "bison", "buffalo",
    "rabbit", "hare",
    "wild boar", "boar", "pig",
    "jackal", "fox", "wolf", "hyena", "coyote",
    "monkey", "langur", "baboon", "chimpanzee", "gorilla",
    "peacock", "eagle", "hawk", "owl", "falcon", "vulture",
    "panda", "kangaroo", "koala", "wombat",
    "rhino", "rhinoceros", "hippo", "hippopotamus",
    "crocodile", "alligator", "snake", "turtle", "tortoise",
    "otter", "badger", "raccoon", "squirrel", "beaver", "porcupine", "hedgehog"
}

# Blacklist of non-animal classes that might contain animal substrings (e.g. teddy bear, hot dog)
NON_ANIMAL_BLACKLIST = {
    "teddy bear", "hot dog"
}


def resolve_species_label(raw_name: str, is_custom_model: bool = False):
    """
    Resolves the true species name from the YOLO model class names.
    - Uses the model's actual class name formatted in title case.
    - Strictly avoids fake mappings (NO cat->Tiger, dog->Jackal, horse->Deer, cow->Wild Boar).
    - Filters out non-animal objects (e.g. 'teddy bear', 'person', 'car').
    """
    clean_name = raw_name.lower().strip()

    if clean_name in NON_ANIMAL_BLACKLIST:
        return None

    if clean_name in KNOWN_ANIMAL_CLASSES:
        return clean_name.title()

    if is_custom_model and not clean_name.startswith("class_"):
        return clean_name.title()

    return None



def format_current_timestamp():
    """Generates timestamp matching YYYY-MM-DD HH:MM required by MongoDB model."""
    now = datetime.datetime.now()
    return now.strftime("%Y-%m-%d %H:%M")


def validate_image(image_path: str):
    """
    Validates file existence and decodes image into a 3-channel RGB PIL Image.
    Raises ValueError / FileNotFoundError if invalid or corrupt.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    if os.path.getsize(image_path) == 0:
        raise ValueError("Uploaded image file is empty (0 bytes).")

    try:
        raw_img = Image.open(image_path)
        raw_img.load()
    except Exception as e:
        raise ValueError(f"Failed to decode image file. File may be corrupted or in an unsupported format: {str(e)}")

    try:
        raw_img = ImageOps.exif_transpose(raw_img)
    except Exception:
        pass

    # Ensure 3-channel RGB format for PyTorch YOLO input
    if raw_img.mode in ("RGBA", "LA") or (raw_img.mode == "P" and "transparency" in raw_img.info):
        rgba = raw_img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[3])
        return bg
    elif raw_img.mode != "RGB":
        return raw_img.convert("RGB")

    return raw_img


def load_model():
    """
    Loads PyTorch model weights.
    Prioritizes custom model weights at python/model/model.pt if available,
    otherwise loads bundled PyTorch YOLO weights at python/model/yolov8n.pt.
    Returns (model, is_custom_model).
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    custom_model = os.path.join(script_dir, "model", "model.pt")
    bundled_model = os.path.join(script_dir, "model", "yolov8n.pt")

    if os.path.exists(custom_model) and os.path.getsize(custom_model) > 0:
        return YOLO(custom_model), True
    elif os.path.exists(bundled_model) and os.path.getsize(bundled_model) > 0:
        return YOLO(bundled_model), False
    else:
        return YOLO("yolov8n.pt"), False


def detect_wildlife(model: YOLO, is_custom_model: bool, img: Image.Image):
    """
    Runs PyTorch YOLO model forward inference on the preprocessed image.
    Extracts all detected wildlife objects with bounding boxes and confidence scores.
    """
    # Run PyTorch inference
    results = model(img, conf=0.20, verbose=False)

    if not results or len(results) == 0:
        return []

    result = results[0]
    boxes = result.boxes

    if boxes is None or len(boxes) == 0:
        return []

    class_names = result.names
    conf_arr = boxes.conf.cpu().numpy()
    cls_arr = boxes.cls.cpu().numpy()
    xyxy_arr = boxes.xyxy.cpu().numpy()

    detections = []

    for i in range(len(boxes)):
        conf = float(conf_arr[i])
        class_id = int(cls_arr[i])
        raw_name = class_names.get(class_id, f"class_{class_id}").lower().strip()

        # Resolve true animal / wildlife species label directly from model class names
        species_label = resolve_species_label(raw_name, is_custom_model)

        if species_label:
            detections.append({
                "species": species_label,
                "confidence": round(conf, 2),
                "box": [round(float(coord), 1) for coord in xyxy_arr[i]]
            })

    # Sort detections by confidence descending
    detections.sort(key=lambda d: d["confidence"], reverse=True)
    return detections


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Image file path is required. Usage: python detect.py <image_path> [location] [timestamp]"
        }))
        sys.exit(1)

    image_path = sys.argv[1]
    location = sys.argv[2].strip() if len(sys.argv) > 2 and sys.argv[2].strip() else "Zone A"
    timestamp = sys.argv[3].strip() if len(sys.argv) > 3 and sys.argv[3].strip() else format_current_timestamp()

    # Validate timestamp format (YYYY-MM-DD HH:MM)
    if len(timestamp) != 16 or timestamp[10] != " ":
        timestamp = format_current_timestamp()

    # Step 1: Validate and preprocess image
    try:
        img = validate_image(image_path)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(0)

    # Step 2: Load PyTorch model
    try:
        model, is_custom_model = load_model()
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Failed to initialize PyTorch detection model: {str(e)}"
        }))
        sys.exit(0)

    # Step 3: Run inference
    try:
        detections = detect_wildlife(model, is_custom_model, img)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"PyTorch model inference failed: {str(e)}"
        }))
        sys.exit(0)

    # Step 4: Handle detection results
    if not detections:
        print(json.dumps({
            "success": False,
            "error": "No wildlife species detected in the image. Please upload a clear photo of wildlife."
        }))
        sys.exit(0)

    # Primary detection is the highest-confidence wildlife match
    primary = detections[0]
    image_filename = os.path.basename(image_path)

    response = {
        "success": True,
        "species": primary["species"],
        "confidence": primary["confidence"],
        "location": location,
        "timestamp": timestamp,
        "image": image_filename,
        "total_detected": len(detections),
        "all_detections": detections
    }

    print(json.dumps(response))
    sys.exit(0)


if __name__ == "__main__":
    main()
