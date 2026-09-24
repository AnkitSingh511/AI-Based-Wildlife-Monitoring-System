import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure backend .env is loaded first before any other logic
dotenv.config({ path: path.join(__dirname, ".env") });

import express from "express";
import cors from "cors";
import connectDB, { isDbConnected } from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import detectionRoutes from "./routes/detectionRoutes.js";
import errorMiddleware from "./middleware/errorMiddleware.js";

const app = express();

// Configure CORS for local development and frontend access
app.use(cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Serve uploaded media statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/detections", detectionRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        database: isDbConnected() ? "connected" : "disconnected",
        port: PORT
    });
});

app.get("/", (req, res) => {
    res.json({
        status: "ok",
        message: "Wildlife Detection System backend is running",
        database: isDbConnected() ? "connected" : "disconnected",
        port: PORT
    });
});

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await connectDB();
    } catch (dbError) {
        console.error("FATAL ERROR: Could not connect to MongoDB on startup:", dbError.message);
        console.error("Exiting process as MongoDB connection is mandatory for detection operations.");
        process.exit(1);
    }

    const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    // Configure 5-minute timeout for processing video frames
    server.timeout = 300000;
    server.keepAliveTimeout = 305000;
    server.headersTimeout = 310000;
};

startServer();