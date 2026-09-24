"""
tests/test_app.py
------------------
Automated test suite for AI Wildlife Monitoring System API.
Validates preprocessing, error handling, schema serialization, health check,
and model missing/loaded state responses.
"""

import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.preprocessing import validate_and_preprocess_image, ImageProcessingError
from app.config import settings
from app.inference import detector


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def create_sample_image_bytes(format="JPEG", color=(0, 128, 0), size=(100, 100)) -> bytes:
    """Helper function to generate valid sample image bytes."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()


# ---------------------------------------------------------
# Preprocessing Unit Tests
# ---------------------------------------------------------
def test_preprocess_valid_image():
    image_bytes = create_sample_image_bytes()
    processed_img = validate_and_preprocess_image(image_bytes)
    assert isinstance(processed_img, Image.Image)
    assert processed_img.mode == "RGB"


def test_preprocess_empty_bytes():
    with pytest.raises(ImageProcessingError) as exc_info:
        validate_and_preprocess_image(b"")
    assert "empty" in str(exc_info.value).lower()


def test_preprocess_invalid_bytes():
    with pytest.raises(ImageProcessingError) as exc_info:
        validate_and_preprocess_image(b"Not an image file content")
    assert "failed to decode" in str(exc_info.value).lower()


# ---------------------------------------------------------
# API Endpoint Tests
# ---------------------------------------------------------
def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "model_loaded" in data
    assert isinstance(data["model_loaded"], bool)


def test_detect_missing_file(client):
    response = client.post("/api/v1/detect")
    assert response.status_code == 422  # FastAPI validation error for missing required parameter


def test_detect_empty_file_upload(client):
    files = {"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
    response = client.post("/api/v1/detect", files=files)
    assert response.status_code == 400
    data = response.json()
    assert "empty" in data["detail"].lower()


def test_detect_corrupted_file_upload(client):
    files = {"file": ("bad.jpg", io.BytesIO(b"invalid corrupt data"), "image/jpeg")}
    response = client.post("/api/v1/detect", files=files)
    assert response.status_code == 400
    data = response.json()
    assert "failed to decode" in data["detail"].lower()


def test_detect_when_model_missing(client):
    """
    If model/model.pt is missing, detection endpoint must return clean HTTP 503
    indicating that trained weights are required.
    """
    if not detector.is_loaded:
        sample_img = create_sample_image_bytes()
        files = {"file": ("test.jpg", io.BytesIO(sample_img), "image/jpeg")}
        response = client.post("/api/v1/detect", files=files)
        assert response.status_code == 503
        data = response.json()
        assert "model" in data["detail"].lower() or "weights" in data["detail"].lower()
