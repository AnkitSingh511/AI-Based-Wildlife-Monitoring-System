"""
app/schemas.py
--------------
Pydantic data models for API request validation and response serialization.
Provides clear, typed contracts for detection output, health metrics, and errors,
enabling easy integration with future Database, Dashboard, and Alert modules.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """
    Spatial bounding box coordinates for a detected object in pixel units.
    x1, y1: Top-left coordinate
    x2, y2: Bottom-right coordinate
    """
    x1: float = Field(..., description="Top-left corner X coordinate (pixels)")
    y1: float = Field(..., description="Top-left corner Y coordinate (pixels)")
    x2: float = Field(..., description="Bottom-right corner X coordinate (pixels)")
    y2: float = Field(..., description="Bottom-right corner Y coordinate (pixels)")


class Detection(BaseModel):
    """
    Single object detection output containing:
    - species: Class label provided directly by the YOLO model (no hard-coding)
    - confidence: Prediction probability score (0.0 to 1.0)
    - bounding_box: Pixel bounding box location
    """
    species: str = Field(..., description="Detected species name (from model class names)")
    confidence: float = Field(..., description="Model confidence score (0.0 to 1.0)")
    bounding_box: BoundingBox = Field(..., description="Bounding box coordinates in image")


class DetectionResponse(BaseModel):
    """
    JSON response structure returned by POST /api/v1/detect.
    """
    success: bool = Field(..., description="Indicates whether detection completed successfully")
    detections: List[Detection] = Field(default_factory=list, description="List of detected wildlife objects")
    total_detections: int = Field(..., description="Count of detected objects in image")
    message: Optional[str] = Field(None, description="Optional status message or warning")


class HealthResponse(BaseModel):
    """
    JSON response structure returned by GET /health.
    """
    status: str = Field(..., description="Service status ('ok' or 'degraded')")
    model_loaded: bool = Field(..., description="True if model.pt is loaded and ready for inference")
    message: Optional[str] = Field(None, description="Health state details")
