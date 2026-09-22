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
    }
});

const Detection = mongoose.model("Detection", detectionSchema);

export default Detection;