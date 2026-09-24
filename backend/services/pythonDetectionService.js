import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_SERVICE_URL = (process.env.PYTHON_SERVICE_URL || "http://localhost:8000").replace(/\/$/, "");

/**
 * Format date to exact required format: YYYY-MM-DD HH:MM
 */
function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  return `${year}-${month}-${day} ${hours}:${mins}`;
}

/**
 * Resolves the path to the Python executable.
 * Prioritizes the dedicated virtual environment in python/.venv.
 */
function resolvePythonPath() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }

  const candidatePaths = [
    path.resolve(__dirname, "../../python/.venv/Scripts/python.exe"),
    path.resolve(__dirname, "../../../python/.venv/Scripts/python.exe"),
    path.resolve(process.cwd(), "python/.venv/Scripts/python.exe"),
    path.resolve(process.cwd(), "../python/.venv/Scripts/python.exe"),
    path.resolve(__dirname, "../../python/.venv/bin/python"),
    path.resolve(process.cwd(), "python/.venv/bin/python")
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to system python command
  return process.platform === "win32" ? "python" : "python3";
}

/**
 * Resolves the absolute directory of the python module containing detect.py & detect_video.py.
 */
function resolvePythonDir() {
  const candidates = [
    path.resolve(__dirname, "../../python"),
    path.resolve(__dirname, "../../../python"),
    path.resolve(process.cwd(), "python"),
    path.resolve(process.cwd(), "../python")
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "detect.py"))) {
      return candidate;
    }
  }

  return path.resolve(__dirname, "../../python");
}

/**
 * Terminate a spawned child process and its child processes cleanly on both Windows and Unix.
 */
function terminateProcess(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === "win32" && proc.pid) {
      spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"]);
    } else {
      proc.kill("SIGKILL");
    }
  } catch (err) {
    console.warn("[Python Detection Service] Warning: Failed to kill process:", err.message);
  }
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
 * Executes a Python CLI detection script with timeout protection and process cleanup.
 */
function runPythonScriptProcess(scriptFilename, args, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const pythonExe = resolvePythonPath();
    const pythonDir = resolvePythonDir();
    const scriptPath = path.resolve(pythonDir, scriptFilename);

    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Python detection script not found at ${scriptPath}`));
    }

    const fullArgs = [scriptPath, ...args];
    console.log(`[Python Detection Service] Spawning: ${pythonExe} in ${pythonDir} with args: ${args.join(" ")}`);

    const pythonProcess = spawn(pythonExe, fullArgs, {
      cwd: pythonDir,
      env: {
        ...process.env,
        PYTHONWARNINGS: "ignore",
        YOLO_VERBOSE: "False",
        PYTHONUNBUFFERED: "1"
      }
    });

    let stdoutData = "";
    let stderrData = "";
    let isFinished = false;

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        terminateProcess(pythonProcess);
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

      try {
        const lines = stdoutData
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("{") && line.endsWith("}"));

        if (lines.length === 0) {
          if (code !== 0) {
            return reject(
              new Error(`Python process exited with error code ${code}: ${stderrData || stdoutData || "Unknown error"}`)
            );
          }
          throw new Error(`No valid JSON output received from Python. Raw output: ${stdoutData}`);
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
 * Executes Python wildlife detection on an uploaded image.
 * Tries Python HTTP microservice first; transparently falls back to CLI spawn.
 *
 * @param {string} imagePath - Absolute path to uploaded image file
 * @param {string} [location="Zone A"] - Sanctuary zone or camera location
 * @param {string} [timestamp] - Timestamp string (YYYY-MM-DD HH:MM)
 */
export async function runPythonDetection(imagePath, location = "Zone A", timestamp = "") {
  const effectiveTimestamp = (timestamp && timestamp.length === 16 && timestamp.includes(" "))
    ? timestamp
    : formatTimestamp();

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
          const rawConf = primary.confidence;
          const roundedConf = Math.round(rawConf * 100) / 100;
          const speciesOut = roundedConf >= 0.40 ? primary.species : "Unknown";

          return {
            species: speciesOut,
            confidence: roundedConf,
            location: location || "Zone A",
            timestamp: effectiveTimestamp,
            image: filename,
            mediaType: "image",
            total_detected: data.total_detections || data.detections.length,
            all_detections: data.detections
          };
        } else {
          return {
            species: "Unknown",
            confidence: 0.0,
            location: location || "Zone A",
            timestamp: effectiveTimestamp,
            image: filename,
            mediaType: "image",
            total_detected: 0,
            all_detections: []
          };
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP Service returned ${response.status}`);
      }
    } catch (httpError) {
      console.warn(`[Python Detection Service] HTTP service attempt failed (${httpError.message}), falling back to CLI...`);
    }
  }

  // 2. Fallback to CLI script execution
  const args = [imagePath, location || "Zone A", effectiveTimestamp];
  const result = await runPythonScriptProcess("detect.py", args, 60000);

  return {
    species: result.species,
    confidence: Math.round(Number(result.confidence) * 100) / 100,
    location: result.location || location || "Zone A",
    timestamp: result.timestamp || effectiveTimestamp,
    image: result.image || path.basename(imagePath),
    mediaType: "image",
    total_detected: result.total_detected || 1,
    all_detections: result.all_detections || []
  };
}

/**
 * Executes Python wildlife detection on an uploaded video.
 * Tries Python HTTP microservice first; transparently falls back to CLI spawn.
 *
 * @param {string} videoPath - Absolute path to uploaded video file
 * @param {string} [location="Zone A"] - Sanctuary zone or camera location
 * @param {string} [timestamp] - Timestamp string (YYYY-MM-DD HH:MM)
 */
export async function runPythonVideoDetection(videoPath, location = "Zone A", timestamp = "") {
  const effectiveTimestamp = (timestamp && timestamp.length === 16 && timestamp.includes(" "))
    ? timestamp
    : formatTimestamp();

  const uploadsDir = path.resolve(__dirname, "../uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

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
      url.searchParams.append("timestamp", effectiveTimestamp);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min timeout for video

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
          confidence: Math.round(Number(data.confidence) * 100) / 100,
          location: data.location || location || "Zone A",
          timestamp: data.timestamp || effectiveTimestamp,
          image: data.image,
          video: data.video || filename,
          frameTimestamp: data.frameTimestamp || "",
          mediaType: "video",
          total_detected: data.total_detected || 1,
          video_duration_seconds: data.video_duration_seconds,
          videoDetections: data.all_detections || []
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP Service returned ${response.status}`);
      }
    } catch (httpError) {
      console.warn(`[Python Detection Service] HTTP video service failed (${httpError.message}), falling back to CLI...`);
    }
  }

  // 2. Fallback to CLI script execution
  const args = [videoPath, location || "Zone A", effectiveTimestamp, uploadsDir];
  const result = await runPythonScriptProcess("detect_video.py", args, 300000);

  return {
    species: result.species,
    confidence: Math.round(Number(result.confidence) * 100) / 100,
    location: result.location || location || "Zone A",
    timestamp: result.timestamp || effectiveTimestamp,
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
