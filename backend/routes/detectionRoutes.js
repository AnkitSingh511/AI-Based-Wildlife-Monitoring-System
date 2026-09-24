import express from "express";

import {
    detectAndCreateDetection,
    detectAndCreateVideoDetection,
    createDetection,
    getAllDetections,
    getDetectionById,
    updateDetection,
    deleteDetection
} from "../controllers/detectionController.js";
import { upload, videoUpload } from "../middleware/uploadMiddleware.js";

// import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// AI Detection & Image Upload endpoints (existing, unchanged)
router.post("/upload-detect", upload.single("image"), detectAndCreateDetection);
router.post("/detect", upload.single("image"), detectAndCreateDetection);

// AI Wildlife Video Detection endpoints
router.post("/upload-detect-video", upload.single("video"), detectAndCreateVideoDetection);
router.post("/detect-video", upload.single("video"), detectAndCreateVideoDetection);

router.post("/", createDetection);

router.get("/",  getAllDetections);

router.get("/:id",  getDetectionById);

router.put("/:id",  updateDetection);

router.delete("/:id",  deleteDetection);

export default router;