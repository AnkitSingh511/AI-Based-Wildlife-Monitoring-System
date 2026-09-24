import mongoose from "mongoose";
import Detection from "../models/Detection.js";
import { runPythonDetection, runPythonVideoDetection } from "../services/pythonDetectionService.js";
import { isDbConnected } from "../config/db.js";

// Integrate the python_detect_tracker module
import trackerModule from "../../python_detect_tracker/tracking/tracker.js";
import anomalyModule from "../../python_detect_tracker/anomaly/anomalyDetector.js";
import alertModule from "../../python_detect_tracker/alerts/alertGenerator.js";

const { trackSingleDetection, getSpeciesHistory } = trackerModule;
const { analyzeDetections } = anomalyModule;
const { generateAlert, generateAlertsFromSampleData } = alertModule;

/**
 * Upload image, run Python AI/ML detection, store in MongoDB, track, and return result
 */
export const detectAndCreateDetection = async (req, res) => {
    try {
        // Step 1: Pre-flight database readiness check
        if (!isDbConnected()) {
            return res.status(503).json({
                success: false,
                message: "Database is temporarily disconnected. Detection cannot be saved at this moment.",
                error: "MongoDB connection is not ready (readyState: " + mongoose.connection.readyState + ")"
            });
        }

        // Support both single file and flexible field upload
        const file = req.file || (req.files && (req.files.image?.[0] || req.files.file?.[0]));
        if (!file) {
            return res.status(400).json({
                success: false,
                message: "No image file provided. Please upload an image under form field 'image' or 'file'."
            });
        }

        const location = req.body.location?.trim() || "Zone A";
        const customTimestamp = req.body.timestamp?.trim() || "";

        // Step 2: Run Python AI detection
        const detectionResult = await runPythonDetection(
            file.path,
            location,
            customTimestamp
        );

        // Double check DB connection before writing
        if (!isDbConnected()) {
            return res.status(503).json({
                success: false,
                message: "Database disconnected while processing detection.",
                error: "MongoDB connection lost"
            });
        }

        // Step 3: Store detection in MongoDB adhering to existing data structure
        const detection = await Detection.create({
            species: detectionResult.species,
            confidence: detectionResult.confidence,
            location: detectionResult.location,
            timestamp: detectionResult.timestamp,
            image: detectionResult.image,
            mediaType: "image"
        });

        // Step 4: Track detection and analyze anomalies with python_detect_tracker
        let trackedInfo = null;
        let alertInfo = null;
        try {
            trackedInfo = trackSingleDetection(detection.toObject());
            const anomalies = analyzeDetections([trackedInfo]);
            if (anomalies.length > 0) {
                alertInfo = generateAlert(anomalies[0]);
            }
        } catch (trackerErr) {
            console.warn("[Tracker] Non-fatal tracking notice:", trackerErr.message);
        }

        res.status(201).json({
            success: true,
            message: "Wildlife detected and saved successfully",
            detection,
            alert: alertInfo,
            tracked: trackedInfo
        });
    } catch (error) {
        console.error("Detection error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to process image detection",
            error: error.message
        });
    }
};

/**
 * Upload video, run Python AI/ML frame detection, store in MongoDB, track, and return result
 */
export const detectAndCreateVideoDetection = async (req, res) => {
    try {
        // Step 1: Pre-flight database readiness check
        if (!isDbConnected()) {
            return res.status(503).json({
                success: false,
                message: "Database is temporarily disconnected. Video detection cannot be saved at this moment.",
                error: "MongoDB connection is not ready (readyState: " + mongoose.connection.readyState + ")"
            });
        }

        const file = req.file || (req.files && (req.files.video?.[0] || req.files.file?.[0]));
        if (!file) {
            return res.status(400).json({
                success: false,
                message: "No video file provided. Please upload a video under form field 'video' or 'file'."
            });
        }

        const location = req.body.location?.trim() || "Zone A";
        const customTimestamp = req.body.timestamp?.trim() || "";

        // Step 2: Run Python video AI detection
        const detectionResult = await runPythonVideoDetection(
            file.path,
            location,
            customTimestamp
        );

        // Double check DB connection before writing
        if (!isDbConnected()) {
            return res.status(503).json({
                success: false,
                message: "Database disconnected while processing video detection.",
                error: "MongoDB connection lost"
            });
        }

        // Step 3: Store detection in MongoDB with video extension fields
        const detection = await Detection.create({
            species: detectionResult.species,
            confidence: detectionResult.confidence,
            location: detectionResult.location,
            timestamp: detectionResult.timestamp,
            image: detectionResult.image,
            mediaType: "video",
            video: detectionResult.video,
            frameTimestamp: detectionResult.frameTimestamp,
            videoDetections: detectionResult.videoDetections || []
        });

        // Step 4: Track detection and analyze anomalies with python_detect_tracker
        let trackedInfo = null;
        let alertInfo = null;
        try {
            trackedInfo = trackSingleDetection(detection.toObject());
            const anomalies = analyzeDetections([trackedInfo]);
            if (anomalies.length > 0) {
                alertInfo = generateAlert(anomalies[0]);
            }
        } catch (trackerErr) {
            console.warn("[Tracker] Non-fatal tracking notice:", trackerErr.message);
        }

        res.status(201).json({
            success: true,
            message: "Wildlife detected in video and saved successfully",
            detection,
            alert: alertInfo,
            tracked: trackedInfo
        });
    } catch (error) {
        console.error("Video detection error:", error);
        res.status(400).json({
            success: false,
            message: error.message || "Failed to process video detection",
            error: error.message
        });
    }
};

/**
 * Create a new detection record (manual CRUD)
 */
export const createDetection = async (req, res) => {
    try {
        if (!isDbConnected()) {
            return res.status(503).json({
                success: false,
                message: "Database is not connected. Cannot create detection.",
                error: "MongoDB disconnected"
            });
        }

        const detection = await Detection.create(req.body);

        try {
            trackSingleDetection(detection.toObject());
        } catch (trackerErr) {
            console.warn("[Tracker] Non-fatal tracking notice:", trackerErr.message);
        }

        res.status(201).json({
            success: true,
            message: "Detection created successfully",
            detection
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to create detection",
            error: error.message
        });
    }
};

/**
 * Get all detections
 */
export const getAllDetections = async (req, res) => {
    try {
        if (!isDbConnected()) {
            return res.status(503).json({
                success: false,
                message: "Database connection unavailable. Please wait while connection reconnects.",
                error: "MongoDB disconnected"
            });
        }

        const detections = await Detection.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            detections
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch detections",
            error: error.message
        });
    }
};

/**
 * Get a single detection by ID
 */
export const getDetectionById = async (req, res) => {
    try {
        if (!isDbConnected()) {
            return res.status(503).json({
                success: false,
                message: "Database connection unavailable. Please wait while connection reconnects.",
                error: "MongoDB disconnected"
            });
        }

        const detection = await Detection.findById(req.params.id);

        if (!detection) {
            return res.status(404).json({
                success: false,
                message: "Detection not found"
            });
        }

        res.status(200).json({
            success: true,
            detection
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch detection",
            error: error.message
        });
    }
};

/**
 * Update an existing detection
 */
export const updateDetection = async (req, res) => {
    try {
        if (!isDbConnected()) {
            return res.status(503).json({
                success: false,
                message: "Database connection unavailable.",
                error: "MongoDB disconnected"
            });
        }

        const detection = await Detection.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!detection) {
            return res.status(404).json({
                success: false,
                message: "Detection not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Detection updated successfully",
            detection
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update detection",
            error: error.message
        });
    }
};

/**
 * Delete a detection record
 */
export const deleteDetection = async (req, res) => {
    try {
        if (!isDbConnected()) {
            return res.status(503).json({
                success: false,
                message: "Database connection unavailable.",
                error: "MongoDB disconnected"
            });
        }

        const detection = await Detection.findByIdAndDelete(req.params.id);

        if (!detection) {
            return res.status(404).json({
                success: false,
                message: "Detection not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Detection deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete detection",
            error: error.message
        });
    }
};

/**
 * Expose tracking history from python_detect_tracker
 */
export const getTrackingHistory = (req, res) => {
    try {
        const history = getSpeciesHistory();
        res.status(200).json({
            success: true,
            history
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch tracking history",
            error: error.message
        });
    }
};

/**
 * Expose alerts from python_detect_tracker
 */
export const getWildlifeAlerts = async (req, res) => {
    try {
        let alerts = [];
        if (isDbConnected()) {
            const recentDetections = await Detection.find().sort({ createdAt: 1 }).limit(50);
            if (recentDetections.length > 0) {
                const trackedList = recentDetections.map((d) => trackSingleDetection(d.toObject()));
                const anomalies = analyzeDetections(trackedList);
                alerts = anomalies.map((a) => generateAlert(a));
            }
        }

        if (alerts.length === 0) {
            alerts = generateAlertsFromSampleData();
        }

        res.status(200).json({
            success: true,
            count: alerts.length,
            alerts
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to generate alerts",
            error: error.message
        });
    }
};