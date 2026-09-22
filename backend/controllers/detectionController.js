import Detection from "../models/Detection.js";

// Create a new detection
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