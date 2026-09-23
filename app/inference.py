"""
app/inference.py
----------------
YOLO Model Inference Service for Wildlife Detection & Classification.

Academic Context:
Inference is the operational phase of machine learning where a pre-trained CNN/YOLO model
receives unseen input images and generates predictions (bounding boxes, class scores).

Key Implementation Principles:
1. Efficient Single Loading: Model is loaded ONCE into memory during server startup.
2. Direct Metadata Reading: Class names are pulled dynamically from `model.names` (NO hardcoded labels).
3. No Mocking: If `model/model.pt` is missing, explicit error signals require trained weights.
"""

import os
import logging
from typing import List, Optional
from PIL import Image
from ultralytics import YOLO

from app.config import settings
from app.schemas import BoundingBox, Detection

logger = logging.getLogger("wildlife_monitoring.inference")


class ModelNotLoadedError(Exception):
    """Exception raised when inference is requested but model.pt is missing or failed to load."""
    pass


class InferenceExecutionError(Exception):
    """Exception raised when an internal error occurs during model execution."""
    pass


class WildlifeDetector:
    """
    Modular Inference Service encapsulating model loading, threshold configuration,
    YOLO execution, and prediction formatting.
    """

    def __init__(self, model_path: str = settings.MODEL_PATH):
        self.model_path = model_path
        self.model: Optional[YOLO] = None
        self.is_loaded: bool = False
        self.load_error_message: Optional[str] = None

    def load_model(self) -> bool:
        """
        Loads YOLO PyTorch model weights (.pt) into RAM/GPU memory once at server startup.

        Returns:
            bool: True if loaded successfully, False if file is missing or corrupted.
        """
        if not os.path.exists(self.model_path):
            self.is_loaded = False
            self.load_error_message = (
                f"Trained model weights file not found at path: '{self.model_path}'. "
                f"Please place your trained YOLO PyTorch weights ('model.pt') inside the 'model/' directory."
            )
            logger.warning(self.load_error_message)
            return False

        try:
            logger.info(f"Loading YOLO model weights from '{self.model_path}'...")
            # Load PyTorch YOLO model via Ultralytics framework
            self.model = YOLO(self.model_path)
            self.is_loaded = True
            self.load_error_message = None
            logger.info("YOLO model loaded successfully and ready for inference.")
            return True
        except Exception as e:
            self.is_loaded = False
            self.load_error_message = (
                f"Failed to initialize PyTorch model from '{self.model_path}'. "
                f"Please verify file is a valid YOLO PyTorch (.pt) weight checkpoint. Details: {str(e)}"
            )
            logger.error(self.load_error_message)
            return False

    def predict(self, image: Image.Image, conf_threshold: Optional[float] = None) -> List[Detection]:
        """
        Executes YOLO object detection pipeline on a preprocessed image.

        Pipeline Steps:
        1. Input Image (PIL Image)
        2. YOLO Forward Pass (`self.model(image)`)
        3. Confidence Threshold Filtering
        4. Coordinate & Label Extraction (`boxes.xyxy`, `boxes.conf`, `boxes.cls`)
        5. Map Class Index -> Class Name via `model.names` metadata

        Parameters:
            image (PIL.Image.Image): Preprocessed 3-channel RGB image.
            conf_threshold (float, optional): Confidence threshold cutoff. Defaults to system setting.

        Returns:
            List[Detection]: List of formatted detection results with species, confidence, and bounding box.
        """
        if not self.is_loaded or self.model is None:
            raise ModelNotLoadedError(
                self.load_error_message or "Trained model.pt weights are required to perform inference."
            )

        threshold = conf_threshold if conf_threshold is not None else settings.CONFIDENCE_THRESHOLD

        try:
            # Perform inference forward pass
            results = self.model(image, conf=threshold, verbose=False)

            detections: List[Detection] = []

            if results and len(results) > 0:
                result = results[0]
                boxes = result.boxes

                if boxes is not None and len(boxes) > 0:
                    # Retrieve species/class names dictionary directly from trained model metadata
                    class_names = result.names  # Dict mapping class ID -> species label string

                    # Convert tensor outputs to NumPy arrays for iteration
                    xyxy_arr = boxes.xyxy.cpu().numpy()  # Bounding box coordinates [x1, y1, x2, y2]
                    conf_arr = boxes.conf.cpu().numpy()  # Confidence probabilities
                    cls_arr = boxes.cls.cpu().numpy()    # Class numerical indices

                    for i in range(len(boxes)):
                        confidence_score = float(conf_arr[i])
                        class_id = int(cls_arr[i])

                        # Dynamic class name resolution from model metadata (No hardcoding)
                        species_name = class_names.get(class_id, f"class_{class_id}")

                        x1, y1, x2, y2 = xyxy_arr[i]

                        bounding_box = BoundingBox(
                            x1=round(float(x1), 2),
                            y1=round(float(y1), 2),
                            x2=round(float(x2), 2),
                            y2=round(float(y2), 2)
                        )

                        detections.append(
                            Detection(
                                species=species_name,
                                confidence=round(confidence_score, 4),
                                bounding_box=bounding_box
                            )
                        )

            return detections

        except Exception as e:
            logger.error(f"Inference execution error: {str(e)}")
            raise InferenceExecutionError(f"Error during YOLO model inference execution: {str(e)}")


# Shared singleton instance managed during app lifespan
detector = WildlifeDetector()
