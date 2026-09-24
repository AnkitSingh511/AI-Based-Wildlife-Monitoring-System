"""
app/main.py
-----------
FastAPI Web Application Server for AI-Based Wildlife Monitoring System.

Pipeline Stage:
Camera/Image -> Preprocessing -> YOLO/CNN -> Detection & Classification -> DB/Dashboard/Alert

Academic Context:
FastAPI handles asynchronous web requests. Using `@asynccontextmanager`, the PyTorch YOLO
model is loaded ONCE into memory during server launch, ensuring optimal efficiency per request.
"""

import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.schemas import DetectionResponse, HealthResponse
from app.preprocessing import validate_and_preprocess_image, ImageProcessingError
from app.inference import detector, ModelNotLoadedError, InferenceExecutionError

# Configure application logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("wildlife_monitoring.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI Lifespan Context Manager:
    Runs startup logic (loading PyTorch model once) and shutdown cleanup.
    """
    logger.info("Initializing AI-Based Wildlife Monitoring System API...")
    logger.info(f"Target model file path: '{settings.MODEL_PATH}'")
    logger.info(f"Default confidence threshold: {settings.CONFIDENCE_THRESHOLD}")
    
    # Load PyTorch model weights into memory once
    model_loaded = detector.load_model()
    if model_loaded:
        logger.info("Model initialization: SUCCESS. Model is ready to serve inference requests.")
    else:
        logger.warning(
            "Model initialization: NOTICE. 'model/model.pt' not found on disk. "
            "API started in stand-by mode. Uploading trained weights to 'model/model.pt' is required for inference."
        )

    yield  # Server serves requests

    logger.info("Shutting down AI Wildlife Monitoring System API...")


# Initialize FastAPI Instance
app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure Cross-Origin Resource Sharing (CORS) for Frontend Dashboard integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health & Status"],
    summary="Check system status and PyTorch model state"
)
async def health_check():
    """
    Health check endpoint returning system operational status and model readiness state.
    """
    is_loaded = detector.is_loaded
    status_str = "ok" if is_loaded else "degraded"
    message = (
        "System operating normally with trained YOLO PyTorch model loaded."
        if is_loaded
        else (detector.load_error_message or "Model file 'model/model.pt' missing. Place trained weights in model/ directory.")
    )
    
    return HealthResponse(
        status=status_str,
        model_loaded=is_loaded,
        message=message
    )


@app.post(
    "/api/v1/detect",
    response_model=DetectionResponse,
    tags=["Wildlife Detection"],
    summary="Detect and classify wildlife species from an uploaded image"
)
async def detect_wildlife(
    file: UploadFile = File(..., description="Uploaded image file (JPEG, PNG, WEBP)"),
    confidence_threshold: Optional[float] = Query(
        None,
        ge=0.0,
        le=1.0,
        description="Optional custom confidence score filter (0.0 to 1.0). Overrides environment default."
    )
):
    """
    Wildlife Image Detection Endpoint:

    - **Validate File**: Check for empty or non-existent upload payloads.
    - **Preprocessing**: Inspect format integrity and convert image to RGB 3-channel tensor.
    - **YOLO Inference**: Run forward pass using loaded PyTorch model.
    - **Filtering & Resolution**: Filter bounding boxes by confidence threshold & retrieve species labels directly from model class names.
    - **Response**: Return structured JSON detection output.
    """
    # 1. Validate File Upload Presence
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image file provided. Please upload an image file under form field key 'file'."
        )

    # 2. Read Uploaded Payload Bytes
    try:
        contents = await file.read()
    except Exception as e:
        logger.error(f"Error reading file upload content: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded image payload. Error: {str(e)}"
        )

    # 3. Image Preprocessing & Integrity Verification
    try:
        preprocessed_image = validate_and_preprocess_image(contents)
    except ImageProcessingError as e:
        logger.warning(f"Preprocessing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # 4. Model Inference Execution
    try:
        effective_conf = confidence_threshold if confidence_threshold is not None else settings.CONFIDENCE_THRESHOLD
        detections = detector.predict(preprocessed_image, conf_threshold=effective_conf)

        return DetectionResponse(
            success=True,
            detections=detections,
            total_detections=len(detections),
            message=f"Successfully processed image. Detected {len(detections)} object(s)."
        )

    except ModelNotLoadedError as e:
        logger.error(f"Inference attempt without loaded model: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except InferenceExecutionError as e:
        logger.error(f"Inference processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failure: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected pipeline exception: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected internal error occurred: {str(e)}"
        )


@app.post(
    "/api/v1/detect-video",
    tags=["Wildlife Video Detection"],
    summary="Detect and classify wildlife species from an uploaded video"
)
async def detect_wildlife_video(
    file: UploadFile = File(..., description="Uploaded video file (MP4, WEBM, AVI, MOV, MKV)"),
    location: Optional[str] = Query("Zone A", description="Sanctuary location or camera zone"),
    timestamp: Optional[str] = Query(None, description="Observation timestamp")
):
    """
    Wildlife Video Detection Endpoint:
    - Ingests uploaded video file.
    - Samples frames at efficient frame intervals (1-2 fps).
    - Runs PyTorch YOLO inference per frame.
    - Deduplicates consecutive sightings of the same species.
    - Saves thumbnail snapshots to backend uploads folder.
    - Returns structured video detection summary and timeline of events.
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No video file provided. Please upload a video file under form field 'file'."
        )

    import tempfile
    import os
    from detect_video import process_video

    # Determine backend uploads directory
    script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    uploads_dir = os.path.abspath(os.path.join(script_dir, "..", "backend", "uploads"))
    os.makedirs(uploads_dir, exist_ok=True)

    # Save uploaded video to temp file
    suffix = os.path.splitext(file.filename)[1].lower() or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_vid:
        temp_path = temp_vid.name
        content = await file.read()
        temp_vid.write(content)

    try:
        result = process_video(
            video_path=temp_path,
            output_dir=uploads_dir,
            location=location or "Zone A",
            timestamp=timestamp or ""
        )

        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.get("error", "No wildlife detected in video")
            )

        # Overwrite video filename with original upload name
        result["video"] = file.filename
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process video: {str(e)}"
        )
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
