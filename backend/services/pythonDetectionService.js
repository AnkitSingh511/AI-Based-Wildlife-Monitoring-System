import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_SERVICE_URL = (process.env.PYTHON_SERVICE_URL || "http://localhost:8000").replace(/\/$/, "");

/**
 * Resolves the path to the Python executable.
 * Prioritizes the virtual environment in python/.venv if it exists.
 */
function resolvePythonPath() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }

  // Check Windows venv
  const winVenv = path.resolve(__dirname, "../../python/.venv/Scripts/python.exe");
  if (fs.existsSync(winVenv)) {
    return winVenv;
  }

  // Check Unix venv
  const unixVenv = path.resolve(__dirname, "../../python/.venv/bin/python");
  if (fs.existsSync(unixVenv)) {
    return unixVenv;
  }

  // Default to system python command
  return process.platform === "win32" ? "python" : "python3";
}

/**
 * Check if the Python FastAPI microservice is available and responding.
 */
async function isPythonServiceAvailable() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Executes Python CLI detection script with timeout protection.
 */
function runPythonScriptProcess(scriptFilename, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const pythonExe = resolvePythonPath();
    const scriptPath = path.resolve(__dirname, "../../python", scriptFilename);

    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Python detection script not found at ${scriptPath}`));
    }

    const fullArgs = [scriptPath, ...args];
    console.log(`[Python Detection Service] Spawning: ${pythonExe} ${fullArgs.join(" ")}`);

    const pythonProcess = spawn(pythonExe, fullArgs);

    let stdoutData = "";
    let stderrData = "";
    let isFinished = false;

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        pythonProcess.kill("SIGKILL");
        reject(new Error(`Python process timed out after ${timeoutMs / 1000} seconds.`));
      }
    }, timeoutMs);

    pythonProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on("error", (err) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);
      console.error("[Python Detection Service] Process spawn error:", err);
      reject(new Error(`Failed to start Python detection process: ${err.message}`));
    });

    pythonProcess.on("close", (code) => {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timer);

      if (stderrData && stderrData.trim().length > 0) {
        console.warn(`[Python Detection Service] stderr output: ${stderrData.trim()}`);
      }

      if (code !== 0) {
        return reject(
          new Error(
            `Python process exited with error code ${code}: ${stderrData || stdoutData || "Unknown error"}`
          )
        );
      }

      try {
        const lines = stdoutData
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("{") && line.endsWith("}"));

        if (lines.length === 0) {
          throw new Error(
            `No valid JSON output received from Python. Raw output: ${stdoutData}`
          );
        }

        const jsonOutput = JSON.parse(lines[lines.length - 1]);

        if (!jsonOutput.success) {
          return reject(
            new Error(jsonOutput.error || "Wildlife detection failed or no animal identified.")
          );
        }

        resolve(jsonOutput);
      } catch (parseError) {
        console.error("[Python Detection Service] Failed to parse JSON:", parseError, stdoutData);
        reject(new Error(`Failed to parse detection output: ${parseError.message}`));
      }
    });
  });
}

/**
 * Executes the Python wildlife detection on an uploaded image.
 * Tries Python HTTP microservice first; transparently falls back to CLI spawn.
 *
 * @param {string} imagePath - Absolute path to the uploaded image file
 * @param {string} [location="Zone A"] - Sanctuary zone or camera location
 * @param {string} [timestamp] - Timestamp string (YYYY-MM-DD HH:MM)
 */
export async function runPythonDetection(imagePath, location = "Zone A", timestamp = "") {
  // 1. Try Python HTTP Microservice if available
  const hasService = await isPythonServiceAvailable();
  if (hasService) {
    try {
      console.log(`[Python Detection Service] Forwarding image to HTTP service: ${PYTHON_SERVICE_URL}/api/v1/detect`);
      const fileBuffer = await fs.promises.readFile(imagePath);
      const filename = path.basename(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

      const formData = new FormData();
      formData.append("file", new Blob([fileBuffer], { type: mime }), filename);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for image

      const response = await fetch(`${PYTHON_SERVICE_URL}/api/v1/detect`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.detections && data.detections.length > 0) {
          const primary = data.detections[0];
          return {
            species: primary.species,
            confidence: primary.confidence,
            location: location || "Zone A",
            timestamp: timestamp || new Date().toISOString().slice(0, 16).replace("T", " "),
            image: filename,
            mediaType: "image",
            total_detected: data.total_detections,
            all_detections: data.detections
          };
        }
      }
    } catch (httpError) {
      console.warn(`[Python Detection Service] HTTP service attempt failed, falling back to CLI: ${httpError.message}`);
    }
  }

  // 2. Fallback to CLI script execution
  const args = [imagePath, location];
  if (timestamp) {
    args.push(timestamp);
  }

  const result = await runPythonScriptProcess("detect.py", args, 60000);
  return {
    species: result.species,
    confidence: result.confidence,
    location: result.location,
    timestamp: result.timestamp,
    image: result.image,
    mediaType: "image",
    total_detected: result.total_detected || 1,
    all_detections: result.all_detections || []
  };
}

/**
 * Executes the Python wildlife detection on an uploaded video.
 * Samples frames at efficient intervals, deduplicates sightings, and saves thumbnails.
 * Tries Python HTTP microservice first; transparently falls back to CLI spawn.
 *
 * @param {string} videoPath - Absolute path to the uploaded video file
 * @param {string} [location="Zone A"] - Sanctuary zone or camera location
 * @param {string} [timestamp] - Timestamp string (YYYY-MM-DD HH:MM)
 */
export async function runPythonVideoDetection(videoPath, location = "Zone A", timestamp = "") {
  const uploadsDir = path.resolve(__dirname, "../uploads");

  // 1. Try Python HTTP Microservice if available
  const hasService = await isPythonServiceAvailable();
  if (hasService) {
    try {
      console.log(`[Python Detection Service] Forwarding video to HTTP service: ${PYTHON_SERVICE_URL}/api/v1/detect-video`);
      const fileBuffer = await fs.promises.readFile(videoPath);
      const filename = path.basename(videoPath);
      const ext = path.extname(videoPath).toLowerCase();
      const mime = ext === ".webm" ? "video/webm" : ext === ".avi" ? "video/x-msvideo" : "video/mp4";

      const formData = new FormData();
      formData.append("file", new Blob([fileBuffer], { type: mime }), filename);

      const url = new URL(`${PYTHON_SERVICE_URL}/api/v1/detect-video`);
      if (location) url.searchParams.append("location", location);
      if (timestamp) url.searchParams.append("timestamp", timestamp);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout

      const response = await fetch(url.toString(), {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return {
          species: data.species,
          confidence: data.confidence,
          location: data.location || location,
          timestamp: data.timestamp || timestamp,
          image: data.image,
          video: data.video || filename,
          frameTimestamp: data.frameTimestamp || "",
          mediaType: "video",
          total_detected: data.total_detected || 1,
          video_duration_seconds: data.video_duration_seconds,
          videoDetections: data.all_detections || []
        };
      }
    } catch (httpError) {
      console.warn(`[Python Detection Service] HTTP video service failed, falling back to CLI: ${httpError.message}`);
    }
  }

  // 2. Fallback to CLI script execution
  const args = [videoPath, location, timestamp || "", uploadsDir];
  const result = await runPythonScriptProcess("detect_video.py", args, 300000);

  return {
    species: result.species,
    confidence: result.confidence,
    location: result.location,
    timestamp: result.timestamp,
    image: result.image,
    video: result.video || path.basename(videoPath),
    frameTimestamp: result.frameTimestamp || "",
    mediaType: "video",
    total_detected: result.total_detected || 1,
    video_duration_seconds: result.video_duration_seconds,
    videoDetections: result.all_detections || []
  };
}

export default {
  runPythonDetection,
  runPythonVideoDetection,
};
