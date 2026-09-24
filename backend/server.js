

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import detectionRoutes from "./routes/detectionRoutes.js";
import errorMiddleware from "./middleware/errorMiddleware.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure backend .env is loaded regardless of working directory
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

app.use(cors());

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Serve uploaded media statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/detections", detectionRoutes);

app.get("/", (req, res) => {
    res.json({ status: "ok", message: "Wildlife Detection System backend is running", port: PORT });
});

app.use(errorMiddleware);

// Fallback to port 5000 to match Vite proxy configuration
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

    // Configure 5-minute timeout for processing video frames
    server.timeout = 300000;
    server.keepAliveTimeout = 305000;
    server.headersTimeout = 310000;
};

startServer();