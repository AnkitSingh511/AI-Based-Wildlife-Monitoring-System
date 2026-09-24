import Detection from "../models/Detection.js";
import { runPythonDetection, runPythonVideoDetection } from "../services/pythonDetectionService.js";

// Upload image, run Python AI/ML detection, store in MongoDB, and return result
export const detectAndCreateDetection = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No image file provided. Please upload an image under form field 'image' or 'file'."
            });
        }

        const location = req.body.location?.trim() || "Zone A";
        const customTimestamp = req.body.timestamp?.trim() || "";

        // Run Python AI detection via spawned process or microservice
        const detectionResult = await runPythonDetection(
            req.file.path,
            location,
            customTimestamp
        );

        // Store detection in MongoDB
        const detection = await Detection.create({
            species: detectionResult.species,
            confidence: detectionResult.confidence,
            location: detectionResult.location,
            timestamp: detectionResult.timestamp,
            image: detectionResult.image,
            mediaType: "image"
        });

        res.status(201).json({
            message: "Wildlife detected and saved successfully",
            detection
        });
    } catch (error) {
        console.error("Detection error:", error);
        res.status(400).json({
            message: error.message || "Failed to process image detection",
            error: error.message
        });
    }
};

// Upload video, run Python AI/ML frame detection, store in MongoDB, and return result
export const detectAndCreateVideoDetection = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: "No video file provided. Please upload a video under form field 'video' or 'file'."
            });
        }

        const location = req.body.location?.trim() || "Zone A";
        const customTimestamp = req.body.timestamp?.trim() || "";

        // Run Python video AI detection
        const detectionResult = await runPythonVideoDetection(
            req.file.path,
            location,
            customTimestamp
        );

        // Store detection in MongoDB with video extension fields
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

        res.status(201).json({
            message: "Wildlife detected in video and saved successfully",
            detection
        });
    } catch (error) {
        console.error("Video detection error:", error);
        res.status(400).json({
            message: error.message || "Failed to process video detection",
            error: error.message
        });
    }
};

// Create a new detection (manual CRUD)
export const createDetection = async (req, res) => {
    try {
        const detection = await Detection.create(req.body);

        res.status(201).json({
            message: "Detection created successfully",
            detection
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to create detection",
            error: error.message
        });
    }
};


// Get all detections
export const getAllDetections = async (req, res) => {
    try {
        const detections = await Detection.find();

        res.status(200).json({
            detections
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch detections",
            error: error.message
        });
    }
};


// Get a detection by ID
export const getDetectionById = async (req, res) => {
    try {
        const detection = await Detection.findById(req.params.id);

        if (!detection) {
            return res.status(404).json({
                message: "Detection not found"
            });
        }

        res.status(200).json({
            detection
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch detection",
            error: error.message
        });
    }
};


// Update a detection
export const updateDetection = async (req, res) => {
    try {
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
                message: "Detection not found"
            });
        }

        res.status(200).json({
            message: "Detection updated successfully",
            detection
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to update detection",
            error: error.message
        });
    }
};


// Delete a detection
export const deleteDetection = async (req, res) => {
    try {
        const detection = await Detection.findByIdAndDelete(req.params.id);

        if (!detection) {
            return res.status(404).json({
                message: "Detection not found"
            });
        }

        res.status(200).json({
            message: "Detection deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete detection",
            error: error.message
        });
    }
};