import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded even if db.js is imported before server.js dotenv config
if (!process.env.MONGODB_URI) {
    dotenv.config({ path: path.resolve(__dirname, "../.env") });
}

let isConnected = false;

// Setup MongoDB connection event listeners for comprehensive observability
mongoose.connection.on("connected", () => {
    isConnected = true;
    console.log(`[MongoDB] Connected successfully to database: "${mongoose.connection.name}" at host: ${mongoose.connection.host}`);
});

mongoose.connection.on("error", (err) => {
    isConnected = false;
    console.error("[MongoDB] Connection error occurred:", err.message);
});

mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.warn("[MongoDB] Connection disconnected.");
});

mongoose.connection.on("reconnected", () => {
    isConnected = true;
    console.log("[MongoDB] Connection successfully re-established.");
});

/**
 * Connect to MongoDB with retry logic and robust connection validation.
 * Never silently fails: throws if connection cannot be established after all retries.
 */
export const connectDB = async (retries = 3) => {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        const errorMsg = "CRITICAL: MONGODB_URI is not defined in environment variables (.env). Cannot connect to database.";
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    // Mask credentials for safe logging
    const maskedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
    console.log(`[MongoDB] Attempting connection to: ${maskedUri}`);

    for (let i = 0; i < retries; i++) {
        try {
            await mongoose.connect(mongoUri, {
                serverSelectionTimeoutMS: 15000,
                // Use IPv4 DNS lookup first on Windows to avoid IPv6 resolution timeouts with MongoDB Atlas SRV records
                family: 4
            });

            isConnected = true;
            return true;
        } catch (error) {
            console.error(`[MongoDB] Connection attempt ${i + 1}/${retries} failed: ${error.message}`);

            if (i < retries - 1) {
                console.log("[MongoDB] Retrying connection in 3 seconds...");
                await new Promise((res) => setTimeout(res, 3000));
            } else {
                console.error("[MongoDB] All connection retries failed.");
                throw new Error(`MongoDB connection failed after ${retries} attempts: ${error.message}`);
            }
        }
    }
};

/**
 * Returns true only if MongoDB connection is open and ready (readyState === 1).
 */
export const isDbConnected = () => {
    return mongoose.connection.readyState === 1;
};

export default connectDB;