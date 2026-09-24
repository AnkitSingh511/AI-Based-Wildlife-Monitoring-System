# Model Directory

This directory stores trained PyTorch YOLO model weights for the Wildlife Monitoring System.

## Required File
- **Filename**: `model.pt`
- **Path**: `model/model.pt`

## Instructions
1. Train your custom YOLO model (e.g., YOLOv8, YOLOv9, YOLOv10, or YOLOv11) on your wildlife species dataset (e.g., tigers, elephants, deer, bears, etc.).
2. Export/save the trained PyTorch checkpoint file as `model.pt`.
3. Place `model.pt` in this directory (`model/model.pt`).
4. When the API server starts up (`uvicorn app.main:app`), it will automatically load `model/model.pt` once into RAM/GPU memory.

*Note: The application will not fabricate predictions if `model.pt` is missing.*
