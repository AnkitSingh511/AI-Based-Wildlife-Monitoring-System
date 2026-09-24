import mongoose from "mongoose";

const detectionSchema = new mongoose.Schema({
    species: {
        type: String,
        required: true,
        trim: true
    },

    confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },

    location: {
        type: String,
        required: true,
        trim: true
    },

    timestamp: {
        type: String,
        required: true,
        match: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
    },

    image: {
        type: String,
        required: true,
        trim: true
    },

    mediaType: {
        type: String,
        enum: ["image", "video"],
        default: "image"
    },

    video: {
        type: String,
        trim: true,
        default: ""
    },

    frameTimestamp: {
        type: String,
        trim: true,
        default: ""
    },

    videoDetections: {
        type: Array,
        default: []
    }
}, { timestamps: true });

const Detection = mongoose.model("Detection", detectionSchema);

export default Detection;