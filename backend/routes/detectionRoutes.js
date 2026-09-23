import express from "express";

import {
    detectAndCreateDetection,
    createDetection,
    getAllDetections,
    getDetectionById,
    updateDetection,
    deleteDetection
} from "../controllers/detectionController.js";
import upload from "../middleware/uploadMiddleware.js";

// import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// AI Detection & Image Upload endpoint
router.post("/upload-detect", upload.single("image"), detectAndCreateDetection);
router.post("/detect", upload.single("image"), detectAndCreateDetection);

router.post("/", createDetection);

router.get("/",  getAllDetections);

router.get("/:id",  getDetectionById);

router.put("/:id",  updateDetection);

router.delete("/:id",  deleteDetection);

export default router;