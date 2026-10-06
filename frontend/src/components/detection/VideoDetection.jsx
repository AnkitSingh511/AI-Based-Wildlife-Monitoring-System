import { useState, useRef, useEffect, useCallback } from "react";
import detectionService from "../../services/detectionService";
import { getSpeciesIcon } from "../../utils/speciesIcons";

export default function VideoDetection({ onDetectionSaved }) {
  // Input method: "record" | "upload"
  const [inputMethod, setInputMethod] = useState("record");

  // Camera & Recording states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [cameraError, setCameraError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedVideo, setRecordedVideo] = useState(null); // { blob, url, name }

  // Upload states
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);

  // Detection states & parameters
  const [location, setLocation] = useState("Zone A");
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState("");
  const [result, setResult] = useState(null);
  const [activeFrameThumb, setActiveFrameThumb] = useState(null);

  const videoPreviewRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
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
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start live camera stream for recording
  const startCamera = useCallback(async (mode = facingMode) => {
    setCameraError("");
    setDetectionError("");
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access is not supported by your browser. Please upload a recorded video file instead.");
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

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("[VideoDetection] Camera error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission denied. Please allow camera access in browser settings.");
      } else {
        setCameraError(`Could not access camera: ${err.message || "Unknown error"}`);
      }
      setIsCameraActive(false);
    }
  }, [facingMode, stopCamera]);

  // Switch Front/Rear Camera
  const switchCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  // Stop Video Recording
  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // Start Video Recording using MediaRecorder API
  const startRecording = () => {
    if (!streamRef.current) {
      setCameraError("Camera stream is not active. Please start the camera first.");
      return;
    }

    setRecordedVideo(null);
    setResult(null);
    setDetectionError("");
    recordedChunksRef.current = [];

    // Find supported mime type
    let mimeType = "video/webm;codecs=vp8";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported("video/webm")) {
        mimeType = "video/webm";
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        mimeType = "video/mp4";
      } else {
        mimeType = "";
      }
    }

    try {
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalMime = mediaRecorder.mimeType || "video/webm";
        const ext = finalMime.includes("mp4") ? ".mp4" : ".webm";
        const blob = new Blob(recordedChunksRef.current, { type: finalMime });
        const url = URL.createObjectURL(blob);
        const name = `wildlife_recording_${Date.now()}${ext}`;

        setRecordedVideo({ blob, url, name });
        stopCamera();
      };

      mediaRecorder.start(250); // collect 250ms chunks
      setIsRecording(true);
      setRecordSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 60) {
            // Auto stop at 60s
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("[VideoDetection] MediaRecorder start error:", err);
      setCameraError(`Failed to start recording: ${err.message}`);
      setIsRecording(false);
    }
  };

  // Handle uploaded video file
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setDetectionError("");
    setResult(null);
    if (!file) return;

    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|avi|mov|mkv)$/i.test(file.name);
    if (!isVideo) {
      setDetectionError("Please select a valid video file (MP4, WebM, AVI, MOV, MKV).");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setDetectionError("Video file size exceeds maximum 100MB limit.");
      return;
    }

    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setUploadedUrl(url);
  };

  // Trigger Video Detection via Backend
  const handleDetect = async () => {
    const videoBlob =
      inputMethod === "record"
        ? recordedVideo?.blob
          ? new File([recordedVideo.blob], recordedVideo.name, { type: recordedVideo.blob.type })
          : null
        : uploadedFile;

    if (!videoBlob) {
      setDetectionError(
        inputMethod === "record"
          ? "Please record a video clip first before running detection."
          : "Please select or drop a video file first."
      );
      return;
    }

    try {
      setIsDetecting(true);
      setDetectionError("");
      setResult(null);

      const formData = new FormData();
      formData.append("video", videoBlob);
      formData.append("location", location);

      const detectionResult = await detectionService.uploadAndDetectVideo(formData);
      setResult(detectionResult);
      if (detectionResult.image) {
        setActiveFrameThumb(detectionResult.image);
      }

      if (onDetectionSaved) {
        onDetectionSaved(detectionResult);
      }
    } catch (err) {
      console.error("[VideoDetection] Video detection error:", err);
      setDetectionError(err.message || "Failed to analyze video for wildlife. Please try again.");
    } finally {
      setIsDetecting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (uploadedUrl) {
        URL.revokeObjectURL(uploadedUrl);
      }
      if (recordedVideo?.url) {
        URL.revokeObjectURL(recordedVideo.url);
      }
    };
  }, [stopCamera, uploadedUrl, recordedVideo]);

  const currentPreviewVideoUrl =
    inputMethod === "record" ? recordedVideo?.url : uploadedUrl;

  const isUnknown =
    result &&
    (result.species === "Unknown" ||
      result.confidence === 0 ||
      (!result.videoDetections?.length && result.total_detected === 0));

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  };

  return (
    <div className="video-detection-module">
      {/* Header & Sub-tab Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h5 className="text-white fw-bold mb-1 d-flex align-items-center gap-2">
            <span>📹</span>
            <span>Wildlife Recorded Video Detection</span>
          </h5>
          <p className="text-secondary small mb-0">
            Record video clips or upload camera trap footage to identify wildlife species across time.
          </p>
        </div>

        {/* Input Switcher */}
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm ${inputMethod === "record" ? "btn-wildlife-primary fw-bold" : "btn-dark border border-secondary text-secondary"}`}
            onClick={() => {
              setInputMethod("record");
              setDetectionError("");
            }}
          >
            🔴 Record Camera Clip
          </button>
          <button
            type="button"
            className={`btn btn-sm ${inputMethod === "upload" ? "btn-wildlife-primary fw-bold" : "btn-dark border border-secondary text-secondary"}`}
            onClick={() => {
              setInputMethod("upload");
              stopCamera();
              setDetectionError("");
            }}
          >
            📁 Upload Video File
          </button>
        </div>
      </div>

      <div className="row g-4 align-items-stretch">
        {/* Left Side: Video Preview & Recording Controls */}
        <div className="col-12 col-lg-7">
          <div
            className="wildlife-card position-relative overflow-hidden d-flex flex-column align-items-center justify-content-center text-center"
            style={{
              minHeight: "380px",
              backgroundColor: "rgba(5, 12, 9, 0.95)",
              border: "1px solid var(--border-color)",
            }}
          >
            {/* 1. Live Camera Stream during Recording Setup */}
            {inputMethod === "record" && isCameraActive && !recordedVideo && (
              <div className="position-relative w-100 h-100 d-flex align-items-center justify-content-center bg-black">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-100 h-100 rounded"
                  style={{ maxHeight: "420px", objectFit: "contain" }}
                />

                {/* Recording HUD indicator */}
                {isRecording && (
                  <div
                    className="position-absolute top-0 start-50 translate-middle-x mt-3 px-3 py-1 rounded-pill d-flex align-items-center gap-2 shadow"
                    style={{
                      backgroundColor: "rgba(220, 38, 38, 0.9)",
                      color: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: "700",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <span className="status-pulse bg-white"></span>
                    <span>REC {formatTimer(recordSeconds)} / 01:00</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. Recorded Video Playback Player or Uploaded Video Player */}
            {currentPreviewVideoUrl && (
              <div className="w-100 h-100 p-2 d-flex flex-column align-items-center justify-content-center bg-black">
                <video
                  src={currentPreviewVideoUrl}
                  controls
                  playsInline
                  className="w-100 rounded shadow"
                  style={{ maxHeight: "420px", objectFit: "contain" }}
                />
              </div>
            )}

            {/* 3. Empty Camera Standby State */}
            {inputMethod === "record" && !isCameraActive && !recordedVideo && (
              <div className="py-5 px-3">
                <div style={{ fontSize: "3.2rem", marginBottom: "0.8rem" }}>📹</div>
                <h5 className="text-white fw-semibold mb-1">Video Recorder Ready</h5>
                <p className="text-secondary small mb-3" style={{ maxWidth: "340px" }}>
                  Press &quot;Start Camera&quot; to preview your lens, then record a 5–30 second wildlife observation clip.
                </p>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="btn btn-wildlife-primary px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2"
                >
                  <span>▶️ Start Camera</span>
                </button>
              </div>
            )}

            {/* 4. Empty Upload State */}
            {inputMethod === "upload" && !uploadedUrl && (
              <div className="p-4 w-100 position-relative" style={{ cursor: "pointer" }}>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/x-msvideo,video/quicktime,video/x-matroska,.mp4,.webm,.avi,.mov,.mkv"
                  onChange={handleFileChange}
                  className="position-absolute top-0 start-0 w-100 h-100 opacity-0"
                  style={{ cursor: "pointer" }}
                  disabled={isDetecting}
                />
                <div
                  className="p-4 rounded border-2 border-dashed border-success border-opacity-50 text-center"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}
                >
                  <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📼</div>
                  <h6 className="text-white fw-bold mb-1">Click to browse or Drag & Drop wildlife video</h6>
                  <p className="text-secondary small mb-0">Supports MP4, WebM, AVI, MOV, and MKV (up to 100MB)</p>
                </div>
              </div>
            )}
          </div>

          {/* Video Control Toolbar */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 p-2 rounded wildlife-card">
            {inputMethod === "record" ? (
              <>
                <div className="d-flex align-items-center gap-2">
                  {!isCameraActive && !recordedVideo && (
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="btn btn-sm btn-wildlife-primary fw-semibold px-3 py-2 d-flex align-items-center gap-1"
                    >
                      <span>▶️ Start Camera</span>
                    </button>
                  )}

                  {isCameraActive && !isRecording && (
                    <>
                      <button
                        type="button"
                        onClick={startRecording}
                        className="btn btn-sm btn-danger px-3 py-2 fw-bold d-flex align-items-center gap-1 shadow"
                      >
                        <span>🔴 Start Recording</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="btn btn-sm btn-outline-secondary px-3 py-2 text-white"
                      >
                        <span>Stop Camera</span>
                      </button>
                    </>
                  )}

                  {isRecording && (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="btn btn-sm btn-warning px-4 py-2 fw-bold d-flex align-items-center gap-1 shadow"
                    >
                      <span>⏹️ Stop Recording ({formatTimer(recordSeconds)})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={switchCamera}
                    className="btn btn-sm btn-wildlife-outline px-3 py-2 d-flex align-items-center gap-1"
                    title="Switch Front/Rear Camera"
                    disabled={isRecording}
                  >
                    <span>🔄 Switch ({facingMode === "environment" ? "Rear" : "Front"})</span>
                  </button>
                </div>

                {recordedVideo && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecordedVideo(null);
                      setResult(null);
                      startCamera(facingMode);
                    }}
                    className="btn btn-sm btn-outline-light px-3 py-2 d-flex align-items-center gap-1"
                  >
                    <span>🔄 Record Again</span>
                  </button>
                )}
              </>
            ) : (
              <div className="d-flex align-items-center gap-2 w-100 justify-content-between">
                <label className="btn btn-sm btn-wildlife-outline px-3 py-2 mb-0 d-flex align-items-center gap-2 cursor-pointer">
                  <span>📁 Change Video File</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/x-msvideo,video/quicktime,video/x-matroska"
                    onChange={handleFileChange}
                    className="d-none"
                  />
                </label>
                {uploadedFile && (
                  <span className="small text-secondary text-truncate" style={{ maxWidth: "260px" }}>
                    {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB)
                  </span>
                )}
              </div>
            )}
          </div>

          {cameraError && (
            <div className="wildlife-alert-danger mt-3 d-flex align-items-center gap-2">
              <span>⚠️</span>
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Right Side: Parameters & Detection Timeline Results */}
        <div className="col-12 col-lg-5 d-flex flex-column justify-content-between">
          <div>
            <div className="wildlife-card p-3 mb-3">
              <label className="small text-secondary fw-semibold mb-2 d-block">
                Sanctuary Zone / Location:
              </label>
              <select
                className="wildlife-select w-100 mb-3"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isDetecting}
              >
                <option value="Zone A">📍 Zone A (Core Habitat)</option>
                <option value="Zone B">📍 Zone B (Buffer Forest)</option>
                <option value="Zone C">📍 Zone C (Water Reservoir)</option>
                <option value="North Ridge">📍 North Ridge Corridor</option>
                <option value="East Grassland">📍 East Grassland</option>
              </select>

              <button
                type="button"
                onClick={handleDetect}
                disabled={isDetecting || (!recordedVideo && !uploadedFile)}
                className="btn btn-wildlife-primary w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow"
              >
                {isDetecting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Analyzing Video Frames...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ Detect in Video</span>
                  </>
                )}
              </button>
            </div>

            {detectionError && (
              <div className="wildlife-alert-danger mb-3 d-flex align-items-center gap-2">
                <span>⚠️</span>
                <span>{detectionError}</span>
              </div>
            )}

            {/* Results Display */}
            {result ? (
              isUnknown ? (
                <div
                  className="wildlife-card p-4 text-center"
                  style={{
                    backgroundColor: "rgba(30, 41, 59, 0.4)",
                    border: "1px dashed rgba(148, 163, 184, 0.4)",
                  }}
                >
                  <div style={{ fontSize: "2.8rem", marginBottom: "0.5rem" }}>🌿</div>
                  <h5 className="text-white fw-bold mb-1">No Wildlife Detected in Video</h5>
                  <p className="text-secondary small mb-3">
                    The video was analyzed across all sampled frames and no recognized wildlife was identified with sufficient confidence.
                  </p>
                  <div className="badge bg-dark text-secondary border border-secondary p-2">
                    Evaluated {result.video_duration_seconds ? `${result.video_duration_seconds}s video` : "video frames"}
                  </div>
                </div>
              ) : (
                <div
                  className="wildlife-card p-3"
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.45)",
                  }}
                >
                  {/* Top Sighting Header */}
                  <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                    <span className="badge-species d-flex align-items-center gap-1" style={{ fontSize: "0.9rem" }}>
                      <span>{getSpeciesIcon(result.species)}</span>
                      <span>{result.species}</span>
                    </span>
                    <span className="badge-confidence-high">
                      {Math.round((result.confidence || 0) * 100)}% Top Conf
                    </span>
                  </div>

                  {/* Representative Snapshot Thumbnail */}
                  {activeFrameThumb && (
                    <div className="text-center mb-2">
                      <img
                        src={`/uploads/${activeFrameThumb}`}
                        alt="Detected frame snapshot"
                        className="img-fluid rounded border border-success border-opacity-50 shadow-sm"
                        style={{ maxHeight: "170px", width: "100%", objectFit: "cover" }}
                      />
                    </div>
                  )}

                  {/* Metadata List */}
                  <div className="small text-secondary pt-1">
                    <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                      <span>Primary Species:</span>
                      <strong className="text-white">
                        {getSpeciesIcon(result.species)} {result.species}
                      </strong>
                    </div>
                    <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                      <span>First Timestamp:</span>
                      <span className="text-warning fw-semibold">⏱️ {result.frameTimestamp || "00:00.0"}</span>
                    </div>
                    <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                      <span>Total Sightings:</span>
                      <span className="badge bg-dark text-info border border-secondary">
                        {result.videoDetections?.length || result.total_detected || 1} Event(s)
                      </span>
                    </div>
                  </div>

                  {/* Interactive Timeline of Sightings in Video */}
                  {result.videoDetections && result.videoDetections.length > 0 && (
                    <div className="mt-3 pt-2 border-top border-secondary border-opacity-25">
                      <span className="small text-secondary fw-semibold d-block mb-2">
                        Sightings Timeline Across Video:
                      </span>
                      <div className="d-flex flex-column gap-2" style={{ maxHeight: "160px", overflowY: "auto" }}>
                        {result.videoDetections.map((vd, i) => (
                          <div
                            key={i}
                            className="p-2 rounded d-flex align-items-center justify-content-between"
                            style={{
                              backgroundColor: activeFrameThumb === vd.image ? "rgba(16, 185, 129, 0.2)" : "rgba(0, 0, 0, 0.3)",
                              border: activeFrameThumb === vd.image ? "1px solid #10b981" : "1px solid var(--border-color)",
                              cursor: "pointer",
                            }}
                            onClick={() => vd.image && setActiveFrameThumb(vd.image)}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <span>{getSpeciesIcon(vd.species)}</span>
                              <div>
                                <span className="text-white fw-semibold small d-block">
                                  {vd.species}
                                </span>
                                <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                                  at {vd.frameTimestamp || `frame #${vd.frameNumber}`}
                                </span>
                              </div>
                            </div>
                            <span className="badge bg-success bg-opacity-25 text-success" style={{ fontSize: "0.75rem" }}>
                              {Math.round(vd.confidence * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 mt-2 border-top border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                    <span className="small text-success d-flex align-items-center gap-1">
                      <span>✅</span>
                      <span>Saved to Detection Records</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setRecordedVideo(null);
                        setUploadedFile(null);
                      }}
                      className="btn btn-sm btn-outline-light py-1 px-2"
                      style={{ fontSize: "0.78rem" }}
                    >
                      New Video
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div
                className="wildlife-card p-4 text-center d-flex flex-column align-items-center justify-content-center"
                style={{
                  minHeight: "200px",
                  border: "1px dashed var(--border-color)",
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                }}
              >
                <div style={{ fontSize: "2.4rem", marginBottom: "0.5rem" }}>🎯</div>
                <h6 className="text-white fw-semibold mb-1">Awaiting Video Input</h6>
                <p className="text-secondary small mb-0" style={{ maxWidth: "280px" }}>
                  Record a short wildlife clip or choose a video file, then press &quot;Detect in Video&quot;.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
