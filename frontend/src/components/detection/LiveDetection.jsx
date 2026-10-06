import { useState, useRef, useEffect, useCallback } from "react";
import detectionService from "../../services/detectionService";
import BoundingBoxOverlay from "./BoundingBoxOverlay";
import { getSpeciesIcon } from "../../utils/speciesIcons";

export default function LiveDetection({ onDetectionSaved }) {
  // Live state
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // "environment" | "user"
  const [sampleInterval, setSampleInterval] = useState(400); // ms between frames (300-500ms default)
  const [location, setLocation] = useState("Zone A");

  // Camera & Video dimensions
  const [cameraError, setCameraError] = useState("");
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });

  // Detection & Telemetry state
  const [liveDetections, setLiveDetections] = useState([]);
  const [primarySpecies, setPrimarySpecies] = useState(null);
  const [primaryConfidence, setPrimaryConfidence] = useState(0);
  const [isDetected, setIsDetected] = useState(false);
  const [inferenceLatency, setInferenceLatency] = useState(null);
  const [effectiveFps, setEffectiveFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [serverError, setServerError] = useState("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Refs for managing stream, lifecycle, and throttling
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isLiveRef = useRef(false);
  const isProcessingRef = useRef(false);
  const loopTimeoutRef = useRef(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const captureFrameRef = useRef(null);

  // Stop all camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Stop Live Detection completely
  const stopLiveDetection = useCallback(() => {
    isLiveRef.current = false;
    setIsLiveActive(false);
    isProcessingRef.current = false;

    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }

    stopCameraStream();
    setLiveDetections([]);
    setIsDetected(false);
    setPrimarySpecies(null);
    setInferenceLatency(null);
    setEffectiveFps(0);
  }, [stopCameraStream]);

  // Capture single frame from live video and send to backend
  const captureAndDetectFrame = useCallback(async () => {
    // 1. Guard checks: live active, not currently in-flight, video ready
    if (!isLiveRef.current) return;
    if (isProcessingRef.current) return; // Skip tick if previous request still in flight

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      // Reschedule next attempt
      if (isLiveRef.current) {
        loopTimeoutRef.current = setTimeout(() => {
          captureFrameRef.current?.();
        }, sampleInterval);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    isProcessingRef.current = true;
    const startTime = performance.now();

    canvas.toBlob(
      async (blob) => {
        if (!blob || !isLiveRef.current) {
          isProcessingRef.current = false;
          return;
        }

        try {
          const formData = new FormData();
          formData.append("image", blob, "live_frame.jpg");
          formData.append("location", location);

          const data = await detectionService.detectLiveFrame(formData);

          if (!isLiveRef.current) return; // Discard result if stopped while in flight

          const roundtripMs = Math.round(performance.now() - startTime);
          setInferenceLatency(roundtripMs);

          // Calculate effective FPS
          const now = Date.now();
          if (lastFrameTimeRef.current > 0) {
            const delta = (now - lastFrameTimeRef.current) / 1000;
            if (delta > 0) {
              setEffectiveFps(Math.round((1 / delta) * 10) / 10);
            }
          }
          lastFrameTimeRef.current = now;

          frameCountRef.current += 1;
          setFrameCount(frameCountRef.current);
          setServerError("");

          if (data.detected && data.species && data.species !== "Unknown") {
            setIsDetected(true);
            setPrimarySpecies(data.species);
            setPrimaryConfidence(Math.round((data.confidence || 0) * 100));

            // Set bounding boxes
            const boxes = data.boundingBoxes || data.all_detections || [];
            setLiveDetections(boxes);
          } else {
            setIsDetected(false);
            setPrimarySpecies(null);
            setPrimaryConfidence(0);
            setLiveDetections([]);
          }
        } catch (err) {
          if (isLiveRef.current) {
            console.warn("[LiveDetection] Stream warning:", err.message);
            setServerError("Connection slow or stream interrupted. Retrying...");
          }
        } finally {
          isProcessingRef.current = false;
          // Reschedule next frame tick
          if (isLiveRef.current) {
            loopTimeoutRef.current = setTimeout(() => {
              captureFrameRef.current?.();
            }, sampleInterval);
          }
        }
      },
      "image/jpeg",
      0.82
    );
  }, [location, sampleInterval]);

  // Keep ref synchronized with latest capture callback
  useEffect(() => {
    captureFrameRef.current = captureAndDetectFrame;
  }, [captureAndDetectFrame]);

  // Start Live Detection stream
  const startLiveDetection = useCallback(async (mode = facingMode) => {
    setCameraError("");
    setServerError("");
    setSaveSuccessMsg("");

    // Stop existing if any
    stopLiveDetection();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access is not supported by your browser.");
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const w = videoRef.current.videoWidth || 640;
        const h = videoRef.current.videoHeight || 480;
        setVideoDimensions({ width: w, height: h });
      }

      isLiveRef.current = true;
      setIsLiveActive(true);
      frameCountRef.current = 0;
      setFrameCount(0);
      lastFrameTimeRef.current = Date.now();

      // Start continuous sampling loop
      loopTimeoutRef.current = setTimeout(() => {
        captureFrameRef.current?.();
      }, 300);
    } catch (err) {
      console.error("[LiveDetection] Camera start error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera permissions in your browser.");
      } else {
        setCameraError(`Could not access camera: ${err.message || "Unknown error"}`);
      }
      stopLiveDetection();
    }
  }, [facingMode, stopLiveDetection]);

  // Switch camera Front/Rear
  const switchCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (isLiveActive) {
      startLiveDetection(nextMode);
    }
  };

  // Save current live frame on-demand
  const saveCurrentSighting = async () => {
    if (!videoRef.current || !isDetected) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setIsSaving(true);
      setSaveSuccessMsg("");

      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setIsSaving(false);
            return;
          }
          try {
            const formData = new FormData();
            formData.append("image", blob, `live_sighting_${Date.now()}.jpg`);
            formData.append("location", location);
            formData.append("saveToDb", "true");

            const saved = await detectionService.detectLiveFrame(formData);
            if (saved.detection && onDetectionSaved) {
              onDetectionSaved(saved.detection);
            }
            setSaveSuccessMsg(`Saved ${saved.species} sighting successfully!`);
            setTimeout(() => setSaveSuccessMsg(""), 4000);
          } catch (err) {
            console.error("Save live sighting failed:", err);
          } finally {
            setIsSaving(false);
          }
        },
        "image/jpeg",
        0.90
      );
    } catch (err) {
      console.error("Error creating sighting snapshot:", err);
      setIsSaving(false);
    }
  };

  // Cleanup on unmount or tab exit
  useEffect(() => {
    return () => {
      stopLiveDetection();
    };
  }, [stopLiveDetection]);

  return (
    <div className="live-detection-module">
      {/* Header & Sub-bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.3rem" }}>⚡</span>
            <h5 className="text-white fw-bold mb-0">Live Real-Time Wildlife Detection</h5>
            <span
              className={`badge py-1 px-2 ${isLiveActive ? "bg-danger text-white animate-pulse" : "bg-secondary text-light"}`}
              style={{ fontSize: "0.72rem" }}
            >
              {isLiveActive ? "🔴 LIVE FEED" : "⚪ STANDBY"}
            </span>
          </div>
          <p className="text-secondary small mb-0 mt-1">
            Continuous real-time automated detection directly from the camera stream.
          </p>
        </div>

        {/* Live Controls */}
        <div className="d-flex align-items-center gap-2">
          {!isLiveActive ? (
            <button
              type="button"
              onClick={() => startLiveDetection(facingMode)}
              className="btn btn-wildlife-primary fw-bold px-4 py-2 d-flex align-items-center gap-2 shadow"
            >
              <span>▶️ Start Live Detection</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopLiveDetection}
              className="btn btn-danger fw-bold px-4 py-2 d-flex align-items-center gap-2 shadow"
            >
              <span>⏹️ Stop Live Detection</span>
            </button>
          )}

          <button
            type="button"
            onClick={switchCamera}
            className="btn btn-wildlife-outline px-3 py-2 d-flex align-items-center gap-1"
            title="Switch Front/Rear Camera"
          >
            <span>🔄 Switch ({facingMode === "environment" ? "Rear" : "Front"})</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Live Video & Controls */}
      <div className="row g-4 align-items-stretch">
        {/* Left Side: Live Video Viewport with HUD Overlay */}
        <div className="col-12 col-lg-8">
          <div
            className="wildlife-card position-relative overflow-hidden d-flex flex-column align-items-center justify-content-center bg-black"
            style={{
              minHeight: "440px",
              border: isDetected ? "2px solid #10b981" : "1px solid var(--border-color)",
              boxShadow: isDetected ? "0 0 25px rgba(16, 185, 129, 0.3)" : "var(--shadow-sm)",
              transition: "all 0.25s ease",
            }}
          >
            {/* Live Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-100 rounded"
              style={{
                maxHeight: "480px",
                objectFit: "contain",
                display: isLiveActive ? "block" : "none",
              }}
              onLoadedMetadata={(e) => {
                setVideoDimensions({
                  width: e.target.videoWidth || 640,
                  height: e.target.videoHeight || 480,
                });
              }}
            />

            {/* Hidden Offscreen Canvas for Sampling Frames */}
            <canvas ref={canvasRef} className="d-none" />

            {/* Bounding Box HUD Overlay Aligned Over Live Video */}
            {isLiveActive && liveDetections.length > 0 && (
              <BoundingBoxOverlay
                boxes={liveDetections}
                imageWidth={videoDimensions.width}
                imageHeight={videoDimensions.height}
              />
            )}

            {/* Live Stream Viewport HUD Banners */}
            {isLiveActive && (
              <>
                {/* Top-Left: Live Status & Telemetry HUD */}
                <div
                  className="position-absolute top-0 start-0 m-3 px-3 py-1 rounded-pill d-flex align-items-center gap-2 shadow"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.75)",
                    backdropFilter: "blur(6px)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    color: "#ecfdf5",
                    fontSize: "0.78rem",
                    zIndex: 20,
                  }}
                >
                  <span className="status-pulse bg-danger"></span>
                  <span className="fw-bold">LIVE CAMERA</span>
                  {inferenceLatency !== null && (
                    <span className="text-secondary ms-1">
                      ⚡ {inferenceLatency}ms • {effectiveFps} FPS
                    </span>
                  )}
                </div>

                {/* Top-Right: Sighting Alert Pill */}
                {isDetected && primarySpecies && (
                  <div
                    className="position-absolute top-0 end-0 m-3 px-3 py-1 rounded-pill d-flex align-items-center gap-2 shadow"
                    style={{
                      backgroundColor: "rgba(6, 78, 59, 0.9)",
                      border: "1px solid #10b981",
                      color: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: "700",
                      zIndex: 20,
                    }}
                  >
                    <span>{getSpeciesIcon(primarySpecies)}</span>
                    <span>{primarySpecies}</span>
                    <span className="badge bg-success" style={{ fontSize: "0.75rem" }}>
                      {primaryConfidence}%
                    </span>
                  </div>
                )}

                {/* Bottom Center: HUD State Banner */}
                <div
                  className="position-absolute bottom-0 start-50 translate-middle-x mb-3 px-3 py-1 rounded-pill shadow-sm"
                  style={{
                    backgroundColor: isDetected ? "rgba(6, 78, 59, 0.85)" : "rgba(15, 23, 42, 0.8)",
                    border: isDetected ? "1px solid #10b981" : "1px solid rgba(148, 163, 184, 0.25)",
                    color: isDetected ? "#ecfdf5" : "#94a3b8",
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    zIndex: 20,
                  }}
                >
                  {isDetected ? (
                    <span>🎯 Wildlife In Frame: {primarySpecies} ({primaryConfidence}%)</span>
                  ) : (
                    <span>🌿 Scene Clear — No Wildlife Detected</span>
                  )}
                </div>
              </>
            )}

            {/* Standby State Display */}
            {!isLiveActive && (
              <div className="py-5 px-3 text-center">
                <div style={{ fontSize: "3.5rem", marginBottom: "0.8rem" }}>📡</div>
                <h5 className="text-white fw-bold mb-1">Live Real-Time Surveillance Standby</h5>
                <p className="text-secondary small mb-3" style={{ maxWidth: "380px" }}>
                  Press &quot;Start Live Detection&quot; to begin continuous automated wildlife tracking from your camera lens.
                </p>
                <button
                  type="button"
                  onClick={() => startLiveDetection(facingMode)}
                  className="btn btn-wildlife-primary px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 shadow"
                >
                  <span>▶️ Start Live Detection</span>
                </button>
              </div>
            )}
          </div>

          {/* Camera or Server Warnings */}
          {cameraError && (
            <div className="wildlife-alert-danger mt-3 d-flex align-items-center gap-2">
              <span>⚠️</span>
              <span>{cameraError}</span>
            </div>
          )}
          {serverError && (
            <div className="wildlife-alert-danger mt-2 d-flex align-items-center gap-2 small">
              <span>⚠️</span>
              <span>{serverError}</span>
            </div>
          )}
          {saveSuccessMsg && (
            <div className="wildlife-alert-success mt-2 d-flex align-items-center gap-2 small">
              <span>✅</span>
              <span>{saveSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* Right Side: Configuration & Real-Time Stats Sidebar */}
        <div className="col-12 col-lg-4 d-flex flex-column justify-content-between">
          <div>
            {/* Live Settings Panel */}
            <div className="wildlife-card p-3 mb-3">
              <h6 className="text-white fw-bold mb-3 d-flex align-items-center gap-2">
                <span>⚙️</span>
                <span>Surveillance Configuration</span>
              </h6>

              {/* Sanctuary Zone */}
              <div className="mb-3">
                <label className="small text-secondary fw-semibold mb-1 d-block">
                  Sanctuary Zone:
                </label>
                <select
                  className="wildlife-select w-100"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  <option value="Zone A">📍 Zone A (Core Habitat)</option>
                  <option value="Zone B">📍 Zone B (Buffer Forest)</option>
                  <option value="Zone C">📍 Zone C (Water Reservoir)</option>
                  <option value="North Ridge">📍 North Ridge Corridor</option>
                  <option value="East Grassland">📍 East Grassland</option>
                </select>
              </div>

              {/* Frame Sampling Interval */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="small text-secondary fw-semibold">Sampling Interval:</label>
                  <span className="badge bg-dark border border-secondary text-info">
                    {sampleInterval} ms ({Math.round((1000 / sampleInterval) * 10) / 10} Hz)
                  </span>
                </div>
                <div className="btn-group w-100" role="group">
                  {[300, 400, 500, 750, 1000].map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      className={`btn btn-sm ${sampleInterval === interval ? "btn-wildlife-primary fw-bold" : "btn-dark border border-secondary text-secondary"}`}
                      onClick={() => setSampleInterval(interval)}
                      style={{ fontSize: "0.75rem" }}
                    >
                      {interval}ms
                    </button>
                  ))}
                </div>
                <div className="text-muted small mt-1" style={{ fontSize: "0.7rem" }}>
                  Faster intervals increase responsiveness for fast-moving wildlife.
                </div>
              </div>

              {/* On-Demand Record Sighting Button */}
              {isLiveActive && isDetected && (
                <button
                  type="button"
                  onClick={saveCurrentSighting}
                  disabled={isSaving}
                  className="btn btn-outline-success w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Saving Sighting...</span>
                    </>
                  ) : (
                    <>
                      <span>💾 Save Sighting</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Live Telemetry Card */}
            <div className="wildlife-card p-3 mb-3">
              <h6 className="text-white fw-bold mb-2 d-flex align-items-center gap-2">
                <span>📊</span>
                <span>Real-Time Telemetry</span>
              </h6>

              <div className="small text-secondary">
                <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                  <span>Stream Status:</span>
                  <span className={isLiveActive ? "text-success fw-bold" : "text-muted"}>
                    {isLiveActive ? "● Active Stream" : "○ Disconnected"}
                  </span>
                </div>
                <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                  <span>Response Time:</span>
                  <span className="text-white fw-semibold">
                    {inferenceLatency !== null ? `${inferenceLatency} ms` : "—"}
                  </span>
                </div>
                <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                  <span>Effective Rate:</span>
                  <span className="text-white fw-semibold">
                    {effectiveFps > 0 ? `${effectiveFps} FPS` : "—"}
                  </span>
                </div>
                <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                  <span>Frames Evaluated:</span>
                  <span className="text-white fw-semibold">{frameCount}</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span>Current Target:</span>
                  <span className="text-white fw-bold">
                    {isDetected && primarySpecies ? (
                      <>
                        {getSpeciesIcon(primarySpecies)} {primarySpecies} ({primaryConfidence}%)
                      </>
                    ) : (
                      <span className="text-muted">None (Scene Clear)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Security & Architecture Note */}
          <div className="p-2 rounded border border-secondary border-opacity-25 bg-dark bg-opacity-50 text-center small text-muted">
            Automated Real-Time Wildlife Surveillance • Continuous Motion Monitoring
          </div>
        </div>
      </div>
    </div>
  );
}
