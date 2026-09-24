#!/usr/bin/env python3
"""
python/detect_video.py
----------------------
AI/ML wildlife video detection service using PyTorch / YOLO and OpenCV.
Processes video frame-by-frame at an efficient interval, detects wildlife species,
deduplicates repetitive frames, saves representative frame snapshots, and returns structured JSON.
"""

import sys
import os
import json
import datetime
import warnings

# Suppress library warnings so stdout contains only clean JSON
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"
os.environ["YOLO_VERBOSE"] = "False"

import cv2
from PIL import Image
import numpy as np
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
    - Normalizes multi-word species names (e.g. 'Brown_bear' -> 'Bear', 'wood_rabbit' -> 'Rabbit').
    - Filters out non-animal objects (e.g. 'teddy bear', 'person', 'car').
    """
    clean_name = raw_name.lower().strip()

    if clean_name in NON_ANIMAL_BLACKLIST:
        return None

    # Handle underscore and parenthetical descriptions: 'brown_bear' -> 'brown bear', 'bat_(animal)' -> 'bat'
    normalized = clean_name.replace("_", " ").split("(")[0].strip()

    # Direct species family normalizations for standard taxonomic alignment
    if "bear" in normalized and "teddy" not in normalized:
        return "Bear"
    if "rabbit" in normalized or "hare" in normalized:
        return "Rabbit"
    if "tiger" in normalized:
        return "Tiger"
    if "lion" in normalized and "sea" not in normalized:
        return "Lion"
    if "zebra" in normalized:
        return "Zebra"
    if "elephant" in normalized:
        return "Elephant"
    if "deer" in normalized or normalized in ("impala", "gazelle", "hartebeest", "antelope", "elk"):
        return "Deer"
    if "cheetah" in normalized:
        return "Cheetah"
    if "leopard" in normalized or "jaguar" in normalized or "panther" in normalized:
        return "Leopard"
    if "dog" in normalized:
        return "Dog"

    if normalized in KNOWN_ANIMAL_CLASSES:
        return normalized.title()

    words = normalized.split()
    for w in words:
        if w in KNOWN_ANIMAL_CLASSES:
            return normalized.title()

    if is_custom_model and not normalized.startswith("class"):
        return normalized.title()

    return None


def format_current_timestamp():
    """Generates timestamp matching YYYY-MM-DD HH:MM required by MongoDB model."""
    now = datetime.datetime.now()
    return now.strftime("%Y-%m-%d %H:%M")


def format_frame_timestamp(seconds: float) -> str:
    """Formats seconds into mm:ss.s format (e.g. 01:23.4)."""
    mins = int(seconds // 60)
    secs = seconds % 60
    return f"{mins:02d}:{secs:04.1f}"


def load_model():
    """Loads PyTorch model weights with yolov8n.pt fallback."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    custom_model = os.path.join(script_dir, "model", "model.pt")
    bundled_model = os.path.join(script_dir, "model", "yolov8n.pt")

    if os.path.exists(custom_model) and os.path.getsize(custom_model) > 0:
        return YOLO(custom_model), True
    elif os.path.exists(bundled_model) and os.path.getsize(bundled_model) > 0:
        return YOLO(bundled_model), False
    else:
        return YOLO("yolov8n.pt"), False


def detect_in_frame(model: YOLO, is_custom_model: bool, rgb_frame: np.ndarray):
    """Runs YOLO inference on a single RGB frame."""
    pil_img = Image.fromarray(rgb_frame)
    results = model(pil_img, conf=0.25, verbose=False)

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

    detections.sort(key=lambda d: d["confidence"], reverse=True)
    return detections


def process_video(video_path: str, output_dir: str, location: str = "Zone A", timestamp: str = ""):
    """
    Reads video, extracts frames at efficient intervals, performs detection,
    deduplicates consecutive detections, and saves representative thumbnails.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    if os.path.getsize(video_path) == 0:
        raise ValueError("Uploaded video file is empty (0 bytes).")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not open video file. Format may be unsupported or corrupted.")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 0 or fps > 120:
        fps = 25.0

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_secs = (total_frames / fps) if total_frames > 0 else 0.0

    # Determine efficient frame step: ~1-2 fps
    if duration_secs <= 30:
        frame_step = max(1, int(round(fps * 0.5)))  # 2 frames per second
    elif duration_secs <= 120:
        frame_step = max(1, int(round(fps * 1.0)))  # 1 frame per second
    else:
        frame_step = max(1, int(round(fps * 2.0)))  # 1 frame every 2 seconds

    model, is_custom_model = load_model()

    os.makedirs(output_dir, exist_ok=True)
    video_base = os.path.splitext(os.path.basename(video_path))[0]

    raw_events = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_step == 0:
            time_sec = frame_idx / fps
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame_detections = detect_in_frame(model, is_custom_model, rgb_frame)

            for det in frame_detections:
                raw_events.append({
                    "species": det["species"],
                    "confidence": det["confidence"],
                    "box": det["box"],
                    "frame_idx": frame_idx,
                    "time_sec": time_sec,
                    "frame_bgr": frame.copy()  # For saving thumbnail
                })

        frame_idx += 1

    cap.release()

    if not raw_events:
        # Save first frame snapshot as thumbnail for low-confidence / unknown sighting
        first_frame_thumb = f"{video_base}_frame_0_unknown.jpg"
        first_frame_path = os.path.join(output_dir, first_frame_thumb)
        cap_retry = cv2.VideoCapture(video_path)
        ret, f0 = cap_retry.read()
        cap_retry.release()
        if ret and f0 is not None:
            cv2.imwrite(first_frame_path, f0, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        else:
            first_frame_thumb = ""

        return {
            "success": True,
            "species": "Unknown",
            "confidence": 0.0,
            "location": location,
            "timestamp": timestamp or format_current_timestamp(),
            "image": first_frame_thumb,
            "video": os.path.basename(video_path),
            "frameTimestamp": "00:00.0",
            "mediaType": "video",
            "total_detected": 0,
            "video_duration_seconds": round(duration_secs, 1),
            "all_detections": []
        }

    # Deduplicate detections: group same species within 3-second windows, keeping highest confidence
    deduplicated = []
    raw_events.sort(key=lambda x: (x["species"], x["time_sec"]))

    current_group = None
    for ev in raw_events:
        if current_group is None:
            current_group = ev
        else:
            same_species = (ev["species"] == current_group["species"])
            within_window = (abs(ev["time_sec"] - current_group["time_sec"]) <= 3.0)

            if same_species and within_window:
                # Keep the higher confidence frame in this window
                if ev["confidence"] > current_group["confidence"]:
                    current_group = ev
            else:
                deduplicated.append(current_group)
                current_group = ev

    if current_group is not None:
        deduplicated.append(current_group)

    # Sort deduplicated events chronologically by appearance
    deduplicated.sort(key=lambda x: x["time_sec"])

    # Save representative snapshot for each unique event
    saved_detections = []
    for i, ev in enumerate(deduplicated):
        time_str = format_frame_timestamp(ev["time_sec"])
        sanitized_species = ev["species"].lower().replace(" ", "_")
        snapshot_filename = f"{video_base}_frame_{ev['frame_idx']}_{sanitized_species}.jpg"
        snapshot_path = os.path.join(output_dir, snapshot_filename)

        # Draw clean bounding box on thumbnail
        annotated_bgr = ev["frame_bgr"].copy()
        x1, y1, x2, y2 = [int(c) for c in ev["box"]]
        cv2.rectangle(annotated_bgr, (x1, y1), (x2, y2), (0, 200, 100), 2)
        label = f"{ev['species']} {int(ev['confidence'] * 100)}%"
        cv2.putText(annotated_bgr, label, (x1, max(20, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 128), 2)

        cv2.imwrite(snapshot_path, annotated_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 88])

        saved_detections.append({
            "species": ev["species"],
            "confidence": ev["confidence"],
            "frameTimestamp": time_str,
            "frameNumber": ev["frame_idx"],
            "box": ev["box"],
            "image": snapshot_filename
        })

    # Phase 8: Validated confidence threshold & Unknown handling
    CONFIDENCE_THRESHOLD = 0.40
    primary = max(saved_detections, key=lambda d: d["confidence"])
    actual_conf = primary["confidence"]
    species_out = primary["species"] if actual_conf >= CONFIDENCE_THRESHOLD else "Unknown"

    return {
        "success": True,
        "species": species_out,
        "confidence": actual_conf,
        "location": location,
        "timestamp": timestamp or format_current_timestamp(),
        "image": primary["image"],
        "video": os.path.basename(video_path),
        "frameTimestamp": primary["frameTimestamp"],
        "mediaType": "video",
        "total_detected": len(saved_detections),
        "video_duration_seconds": round(duration_secs, 1),
        "all_detections": saved_detections
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python detect_video.py <video_path> [location] [timestamp] [output_dir]"
        }))
        sys.exit(1)

    video_path = sys.argv[1]
    location = sys.argv[2].strip() if len(sys.argv) > 2 and sys.argv[2].strip() else "Zone A"
    timestamp = sys.argv[3].strip() if len(sys.argv) > 3 and sys.argv[3].strip() else format_current_timestamp()

    # Determine uploads output directory (default to backend/uploads)
    if len(sys.argv) > 4 and sys.argv[4].strip():
        output_dir = sys.argv[4].strip()
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_dir = os.path.abspath(os.path.join(script_dir, "..", "backend", "uploads"))

    try:
        result = process_video(video_path, output_dir, location, timestamp)
        print(json.dumps(result))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Video detection failed: {str(e)}"
        }))
        sys.exit(0)


if __name__ == "__main__":
    main()
