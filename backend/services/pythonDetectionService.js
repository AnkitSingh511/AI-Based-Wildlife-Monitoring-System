import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Executes the Python wildlife detection process on the uploaded image.
 *
 * @param {string} imagePath - Absolute path to the uploaded image file
 * @param {string} [location="Zone A"] - Sanctuary zone or camera location
 * @param {string} [timestamp] - Timestamp string (YYYY-MM-DD HH:MM)
 * @returns {Promise<{ species: string, confidence: number, location: string, timestamp: string, image: string }>}
 */
export function runPythonDetection(imagePath, location = "Zone A", timestamp = "") {
  return new Promise((resolve, reject) => {
    const pythonExe = resolvePythonPath();
    const scriptPath = path.resolve(__dirname, "../../python/detect.py");

    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Python detection script not found at ${scriptPath}`));
    }

    const args = [scriptPath, imagePath, location];
    if (timestamp) {
      args.push(timestamp);
    }

    console.log(`[Python Detection Service] Spawning: ${pythonExe} ${args.join(" ")}`);

    const pythonProcess = spawn(pythonExe, args);

    let stdoutData = "";
    let stderrData = "";

    pythonProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on("error", (err) => {
      console.error("[Python Detection Service] Process spawn error:", err);
      reject(new Error(`Failed to start Python detection process: ${err.message}`));
    });

    pythonProcess.on("close", (code) => {
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
        // Find the last non-empty line in stdout which contains the JSON payload
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

        resolve({
          species: jsonOutput.species,
          confidence: jsonOutput.confidence,
          location: jsonOutput.location,
          timestamp: jsonOutput.timestamp,
          image: jsonOutput.image,
        });
      } catch (parseError) {
        console.error("[Python Detection Service] Failed to parse JSON:", parseError, stdoutData);
        reject(new Error(`Failed to parse detection output: ${parseError.message}`));
      }
    });
  });
}

export default {
  runPythonDetection,
};
