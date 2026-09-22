import express from "express";

import {
    createDetection,
    getAllDetections,
    getDetectionById,
    updateDetection,
    deleteDetection
} from "../controllers/detectionController.js";

// import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", createDetection);

router.get("/",  getAllDetections);

router.get("/:id",  getDetectionById);

router.put("/:id",  updateDetection);

router.delete("/:id",  deleteDetection);

export default router;