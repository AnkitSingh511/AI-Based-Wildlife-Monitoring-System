import express from "express";

import {
    detectAndCreateDetection,
    detectAndCreateVideoDetection,
    createDetection,
    getAllDetections,
    getDetectionById,
    updateDetection,
    deleteDetection,
    getWildlifeAlerts,
    getTrackingHistory,
    liveFrameDetection
} from "../controllers/detectionController.js";
import { uploadImageFlexible, uploadVideoFlexible } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Real-time Live Camera AI Detection endpoint
router.post("/live-frame", uploadImageFlexible, liveFrameDetection);

// AI Wildlife Alerts & Tracking endpoints (from python_detect_tracker)
router.get("/alerts", getWildlifeAlerts);
router.get("/tracking", getTrackingHistory);

// AI Detection & Image Upload endpoints (both /upload-detect and /detect for robust routing)
router.post("/upload-detect", uploadImageFlexible, detectAndCreateDetection);
router.post("/detect", uploadImageFlexible, detectAndCreateDetection);

// AI Wildlife Video Detection endpoints (both /upload-detect-video and /detect-video)
router.post("/upload-detect-video", uploadVideoFlexible, detectAndCreateVideoDetection);
router.post("/detect-video", uploadVideoFlexible, detectAndCreateVideoDetection);

// Standard CRUD endpoints
router.post("/", createDetection);
router.get("/", getAllDetections);
router.get("/:id", getDetectionById);
router.put("/:id", updateDetection);
router.delete("/:id", deleteDetection);

export default router;