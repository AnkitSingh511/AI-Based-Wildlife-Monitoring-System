# AI-Based Wildlife Monitoring System — Detection & Classification Module

An academic project implementing Stage 1 (AI Detection & Classification) of an automated **AI-Based Wildlife Monitoring System**.

---

## Project Overview & Pipeline Architecture

The overall system architecture for wildlife camera trap monitoring is structured into modular stages:

```
Camera/Image ──► Preprocessing ──► YOLO/CNN Model ──► Detection & Classification ──► Database ──► Dashboard ──► Alert
     │                  │                 │                      │
     └──────────────────┴─────────────────┴──────────────────────┘
                   [ Modern FastAPI Python Service ]
```

This service covers the core computer vision pipeline:
1. **Camera / Image Ingestion**: Accepts uploaded image files via HTTP multipart POST request.
2. **Preprocessing**: Validates image byte streams, standardizes EXIF orientations, and converts images into 3-channel RGB tensors.
3. **YOLO CNN Inference**: Runs PyTorch YOLO forward pass once per image using loaded weights.
4. **Detection & Classification**: Filters predictions by confidence threshold and extracts species labels and bounding box pixel coordinates.

---

## Academic & Technical Concepts

### 1. What YOLO Does
**YOLO (You Only Look Once)** is a state-of-the-art, real-time single-stage Convolutional Neural Network (CNN) object detection architecture. Unlike traditional multi-stage detectors (like Faster R-CNN) that propose regions and then classify them separately, YOLO frames object detection as a single regression problem. It divides an image into a grid and simultaneously predicts bounding box coordinates (`x1, y1, x2, y2`), objectness scores, and class probability distributions across all species in one single forward pass.

### 2. What Preprocessing Does
**Preprocessing** is the data transformation stage before deep learning model execution. Raw images coming from field camera traps may contain varied file formats (JPEG, PNG, WEBP), transparent alpha channels (RGBA), single-channel grayscale data, corrupted byte headers, or rotated EXIF orientations. Preprocessing cleans the input image, verifies pixel integrity, standardizes color spaces into 3-channel RGB, and formats the image matrix so the neural network receives valid, uncorrupted tensor data.

### 3. What Inference Means
**Inference** refers to the execution phase where a trained Machine Learning / Deep Learning model processes new, unseen data (images) to generate predictions. Unlike the *training* phase (which calculates gradients, updates neural network weights, and requires loss functions), *inference* runs only the forward pass through the trained neural network layers to evaluate bounding boxes, species class labels, and confidence probability scores.

### 4. What `model.pt` Is
`model.pt` is a binary PyTorch checkpoint file containing the pre-trained weights, biases, neural network architecture definitions, and class name metadata (`model.names`) learned during model training. In PyTorch and Ultralytics YOLO, the `.pt` extension represents serialized PyTorch Tensors and state dictionaries saved via Python `pickle`. 

> **Important Note on Trained Weights**:
> This project does **not** invent, fabricate, or hard-code mock species predictions. The system requires real trained PyTorch weights (`model/model.pt`). If `model.pt` is missing, the API starts in degraded status and clearly informs the user that trained weights are required.

---

## Project Directory Structure

```text
miniproject/
├── app/
│   ├── __init__.py          # Python package initializer
│   ├── config.py            # Environment configuration & settings
│   ├── schemas.py           # Pydantic JSON request/response data models
│   ├── preprocessing.py     # Image validation & RGB standardization logic
│   ├── inference.py         # YOLO PyTorch model loading & prediction service
│   └── main.py              # FastAPI app, CORS setup, and REST API endpoints
├── model/
│   ├── README.md            # Guide for placing trained model.pt
│   └── model.pt             # [USER PROVIDED] Trained PyTorch YOLO weights
├── requirements.txt         # Project Python dependencies
└── README.md                # System documentation
```

---

## Installation & Setup Guide

### 1. Prerequisites
- Python 3.9, 3.10, or 3.11 installed.
- `pip` (Python package manager).

### 2. Create Virtual Environment (Recommended)

**On Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**On Linux/macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
Install all required packages from `requirements.txt`:
```bash
pip install -r requirements.txt
```

### 4. Place Trained Model Weights
Train a YOLO model (e.g. YOLOv8) on your wildlife species dataset (such as tigers, elephants, deer, etc.) and place the generated `model.pt` file inside the `model/` directory:
```text
miniproject/model/model.pt
```

---

## Running the API Server

Start the server using `uvicorn`:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will start at `http://localhost:8000`.

### Automatic Model Loading
When the server launches:
- The PyTorch YOLO model is **loaded ONCE** during startup into memory (using FastAPI lifespan manager).
- The model is **NOT** reloaded per HTTP request, keeping inference response times extremely low.

---

## API Documentation & Endpoint Reference

FastAPI automatically generates interactive Swagger OpenAPI documentation:
- **Interactive Swagger UI**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`

### Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Check server health and verify if `model.pt` is loaded. |
| `POST` | `/api/v1/detect` | Upload image file via `multipart/form-data` for detection. |

---

## Testing the API

### 1. Check Health Endpoint (`GET /health`)

**Using `curl`:**
```bash
curl -X GET "http://localhost:8000/health"
```

**Example Health Response (Model Loaded):**
```json
{
  "status": "ok",
  "model_loaded": true,
  "message": "System operating normally with trained YOLO PyTorch model loaded."
}
```

**Example Health Response (Model Missing):**
```json
{
  "status": "degraded",
  "model_loaded": false,
  "message": "Trained model weights file not found at path: 'model/model.pt'. Please place your trained YOLO PyTorch weights ('model.pt') inside the 'model/' directory."
}
```

---

### 2. Detection Endpoint (`POST /api/v1/detect`)

**Using `curl` (Uploading an image):**
```bash
curl -X POST "http://localhost:8000/api/v1/detect" \
  -F "file=@/path/to/wildlife_image.jpg"
```

**Using `curl` with Custom Confidence Threshold:**
```bash
curl -X POST "http://localhost:8000/api/v1/detect?confidence_threshold=0.60" \
  -F "file=@/path/to/wildlife_image.jpg"
```

**Example Successful Response:**
```json
{
  "success": true,
  "detections": [
    {
      "species": "tiger",
      "confidence": 0.9412,
      "bounding_box": {
        "x1": 120.5,
        "y1": 80.0,
        "x2": 470.2,
        "y2": 360.8
      }
    }
  ],
  "total_detections": 1,
  "message": "Successfully processed image. Detected 1 object(s)."
}
```

*(Note: The species name `"tiger"` is dynamically extracted from the class names of your trained `model.pt`. The system never hard-codes class names).*

---

## Configuration & Environment Variables

You can configure system behavior using environment variables or a `.env` file in the root directory:

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `CONFIDENCE_THRESHOLD` | `0.50` | Minimum confidence probability to include a detection. |
| `MODEL_PATH` | `model/model.pt` | Path to PyTorch model weights file. |
| `HOST` | `0.0.0.0` | Host IP for Uvicorn server. |
| `PORT` | `8000` | Listening port for Uvicorn server. |

---

## Future Pipeline Integration (Modular Design)

The structured JSON output from `/api/v1/detect` allows straightforward integration into subsequent pipeline modules:
- **Database Module**: Store `species`, `confidence`, `bounding_box`, timestamp, and camera location into PostgreSQL/MongoDB.
- **Frontend Dashboard**: Display live camera feed bounding boxes using the returned `x1, y1, x2, y2` pixel coordinates.
- **Wildlife Alert System**: Trigger SMS/Email/Webhook notifications when specific species (e.g. endangered species or poachers) are detected.
