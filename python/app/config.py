"""
app/config.py
--------------
Configuration Settings for AI Wildlife Monitoring System.
This file manages application settings and environment variables such as
model file paths, detection confidence thresholds, and CORS settings.
"""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables with sensible defaults.
    """
    # Metadata for FastAPI OpenAPI Documentation
    APP_TITLE: str = "AI-Based Wildlife Monitoring System - Detection Module"
    APP_VERSION: str = "1.0.0"
    APP_DESCRIPTION: str = (
        "AI detection and classification service using YOLO for wildlife monitoring. "
        "Forming Stage 1 of the monitoring pipeline: Camera -> Preprocessing -> YOLO -> Detection -> DB/Dashboard/Alert."
    )
    
    # Model Configuration
    # Path where the trained PyTorch YOLO model (.pt) should be stored
    MODEL_PATH: str = os.path.join("model", "model.pt")
    
    # Default confidence threshold for filtering detections (0.0 to 1.0)
    # Can be overridden via environment variable: CONFIDENCE_THRESHOLD=0.50
    CONFIDENCE_THRESHOLD: float = 0.50
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS Configuration - Enables cross-origin requests from frontend dashboards
    CORS_ORIGINS: list[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


# Global settings instance used throughout the application
settings = Settings()
