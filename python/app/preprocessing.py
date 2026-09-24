"""
app/preprocessing.py
--------------------
Image Validation and Preprocessing Module for Wildlife Detection Pipeline.

Academic Context:
In an AI computer vision pipeline, preprocessing ensures raw image files sent by
cameras or users are verified, sanitized, and formatted into model-compatible data structures.

Preprocessing Steps:
1. File Integrity Verification: Ensure byte payload is non-empty.
2. Format Validation: Verify image decoding (JPEG, PNG, WEBP, etc.) using Pillow.
3. Color Space Standardization: Convert all input images (RGBA, Grayscale, CMYK) to RGB 3-channel layout.
"""

import io
from PIL import Image, ImageOps


class ImageProcessingError(Exception):
    """Custom exception raised when image loading or validation fails."""
    pass


def validate_and_preprocess_image(image_bytes: bytes) -> Image.Image:
    """
    Validates uploaded raw bytes and preprocesses them into a standard RGB PIL Image
    compatible with PyTorch / YOLO models.

    Parameters:
        image_bytes (bytes): Binary content of uploaded image file.

    Returns:
        PIL.Image.Image: Preprocessed 3-channel RGB PIL Image ready for model inference.

    Raises:
        ImageProcessingError: If the byte array is empty, corrupted, or not a valid image.
    """
    # 1. Step 1: Check for empty payload
    if not image_bytes or len(image_bytes) == 0:
        raise ImageProcessingError("Uploaded image file is empty (0 bytes). Please upload a valid image.")

    try:
        # 2. Step 2: Open image stream with PIL
        image = Image.open(io.BytesIO(image_bytes))
        
        # Verify format and attempt to load image pixels to detect truncated/corrupted files
        image.load()
    except Exception as e:
        raise ImageProcessingError(f"Failed to decode image file. File may be corrupted or in an unsupported format. Error: {str(e)}")

    # 3. Step 3: Handle image orientation metadata (EXIF tags from wildlife camera traps)
    try:
        image = ImageOps.exif_transpose(image)
    except Exception:
        # If EXIF reading fails, continue with default orientation
        pass

    # 4. Step 4: Normalize color channels to 3-channel RGB
    # YOLO models expect 3-channel (RGB) tensor input.
    # Transparent PNGs (RGBA) or single-channel Grayscale images are converted safely here.
    if image.mode != "RGB":
        image = image.convert("RGB")

    return image
