import { useState, useRef, useEffect, useCallback } from "react";
import detectionService from "../../services/detectionService";
import BoundingBoxOverlay from "./BoundingBoxOverlay";
import { getSpeciesIcon } from "../../utils/speciesIcons";

export default function PhotoDetection({ onDetectionSaved }) {
  // Input method: "camera" | "upload"
  const [inputMethod, setInputMethod] = useState("camera");

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState("environment"); // "environment" (rear) or "user" (front)
  const [cameraError, setCameraError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState(null); // { dataUrl, blob, width, height }

  // Upload states
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedPreview, setUploadedPreview] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 640, height: 480 });

  // Detection parameters & states
  const [location, setLocation] = useState("Zone A");
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState("");
  const [result, setResult] = useState(null);
  const [viewMode, setViewMode] = useState("overlay"); // "overlay" | "annotated"

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const containerRef = useRef(null);

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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async (mode = facingMode) => {
    setCameraError("");
    setDetectionError("");
    setResult(null);

    // Stop existing stream if running
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera access is not supported by your browser. Please use photo upload instead.");
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
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      setCapturedPhoto(null);
    } catch (err) {
      console.error("[PhotoDetection] Camera error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Please allow camera access in your browser settings.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraError("No camera device found on this system.");
      } else {
        setCameraError(`Could not access camera: ${err.message || "Unknown camera error"}`);
      }
      setIsCameraActive(false);
    }
  }, [facingMode, stopCamera]);

  // Switch between Front & Rear mobile cameras
  const switchCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (isCameraActive) {
      startCamera(nextMode);
    }
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    canvas.toBlob(
      (blob) => {
        setCapturedPhoto({ dataUrl, blob, width: w, height: h });
        setImageDimensions({ width: w, height: h });
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  // Retake photo: clear captured photo and restart camera
  const retakePhoto = () => {
    setCapturedPhoto(null);
    setResult(null);
    setDetectionError("");
    startCamera(facingMode);
  };

  // Handle uploaded file
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setDetectionError("");
    setResult(null);
    if (!file) return;

    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setDetectionError("Please select a valid image file (JPEG, PNG, or WebP).");
      return;
    }

    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setUploadedPreview(url);

    // Measure natural dimensions
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth || 640, height: img.naturalHeight || 480 });
    };
    img.src = url;
  };

  // Trigger Wildlife Detection on photo
  const handleDetect = async () => {
    const fileToUpload =
      inputMethod === "camera"
        ? capturedPhoto?.blob
          ? new File([capturedPhoto.blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" })
          : null
        : uploadedFile;

    if (!fileToUpload) {
      setDetectionError(
        inputMethod === "camera"
          ? "Please capture a photo first before detecting."
          : "Please choose or drop an image file first."
      );
      return;
    }

    try {
      setIsDetecting(true);
      setDetectionError("");
      setResult(null);

      const formData = new FormData();
      formData.append("image", fileToUpload);
      formData.append("location", location);

      const detectionResult = await detectionService.uploadAndDetect(formData);
      setResult(detectionResult);

      if (onDetectionSaved) {
        onDetectionSaved(detectionResult);
      }
    } catch (err) {
      console.error("[PhotoDetection] Detection failure:", err);
      setDetectionError(err.message || "Wildlife detection failed or no animal identified. Please try again.");
    } finally {
      setIsDetecting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (uploadedPreview) {
        URL.revokeObjectURL(uploadedPreview);
      }
    };
  }, [stopCamera, uploadedPreview]);

  // Image source to display in preview
  const currentPhotoSrc =
    inputMethod === "camera" ? capturedPhoto?.dataUrl : uploadedPreview;

  const isUnknown =
    result &&
    (result.species === "Unknown" ||
      result.confidence === 0 ||
      (!result.boundingBoxes?.length && !result.all_detections?.length && result.total_detected === 0));

  return (
    <div className="photo-detection-module">
      {/* Header & Sub-tab Bar */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom border-secondary border-opacity-25">
        <div>
          <h5 className="text-white fw-bold mb-1 d-flex align-items-center gap-2">
            <span>📷</span>
            <span>Wildlife Photo Trap & Image Detection</span>
          </h5>
          <p className="text-secondary small mb-0">
            Use live mobile camera or upload field photography to identify species, confidence ratings, and bounding boxes.
          </p>
        </div>

        {/* Input Switcher */}
        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm ${inputMethod === "camera" ? "btn-wildlife-primary fw-bold" : "btn-dark border border-secondary text-secondary"}`}
            onClick={() => {
              setInputMethod("camera");
              setDetectionError("");
            }}
          >
            📸 Live Camera
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
            📁 Upload Image
          </button>
        </div>
      </div>

      <div className="row g-4 align-items-stretch">
        {/* Left Side: Camera Preview / Photo Capture / Upload Area */}
        <div className="col-12 col-lg-7">
          <div
            ref={containerRef}
            className="wildlife-card position-relative overflow-hidden d-flex flex-column align-items-center justify-content-center text-center"
            style={{
              minHeight: "380px",
              backgroundColor: "rgba(5, 12, 9, 0.95)",
              border: "1px solid var(--border-color)",
            }}
          >
            {/* 1. Live Camera Stream */}
            {inputMethod === "camera" && isCameraActive && (
              <div className="position-relative w-100 h-100 d-flex align-items-center justify-content-center bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-100 h-100 rounded"
                  style={{ maxHeight: "440px", objectFit: "contain" }}
                />
                {/* Viewfinder Target Grid Overlay */}
                <div
                  className="position-absolute top-50 start-50 translate-middle pointer-events-none"
                  style={{
                    width: "70%",
                    height: "65%",
                    border: "1px dashed rgba(52, 211, 153, 0.4)",
                    borderRadius: "12px",
                    boxShadow: "0 0 20px rgba(16, 185, 129, 0.15)",
                  }}
                >
                  <span className="position-absolute top-0 start-50 translate-middle badge bg-dark text-success border border-success border-opacity-25" style={{ fontSize: "0.68rem" }}>
                    Wildlife Viewfinder
                  </span>
                </div>
              </div>
            )}

            {/* 2. Captured Photo or Uploaded Image with Bounding Boxes */}
            {currentPhotoSrc && (!isCameraActive || inputMethod === "upload") && (
              <div className="position-relative w-100 d-flex align-items-center justify-content-center bg-black p-2">
                {viewMode === "annotated" && result?.annotatedImage ? (
                  <img
                    src={
                      result.annotatedImage.startsWith("data:")
                        ? result.annotatedImage
                        : `/uploads/${result.annotatedImage}`
                    }
                    alt="Annotated detection"
                    className="img-fluid rounded shadow"
                    style={{ maxHeight: "420px", objectFit: "contain", width: "100%" }}
                  />
                ) : (
                  <div className="position-relative d-inline-block w-100 text-center">
                    <img
                      src={currentPhotoSrc}
                      alt="Selected wildlife capture"
                      className="img-fluid rounded shadow"
                      style={{ maxHeight: "420px", objectFit: "contain", maxWidth: "100%" }}
                    />
                    {/* Render Bounding Boxes Over Photo */}
                    {result && !isUnknown && (
                      <BoundingBoxOverlay
                        boxes={result.boundingBoxes || result.all_detections || []}
                        imageWidth={result.imageWidth || imageDimensions.width}
                        imageHeight={result.imageHeight || imageDimensions.height}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. Empty Camera Standby State */}
            {inputMethod === "camera" && !isCameraActive && !capturedPhoto && (
              <div className="py-5 px-3">
                <div style={{ fontSize: "3.2rem", marginBottom: "0.8rem" }}>📷</div>
                <h5 className="text-white fw-semibold mb-1">Camera Is Inactive</h5>
                <p className="text-secondary small mb-3" style={{ maxWidth: "340px" }}>
                  Press &quot;Start Camera&quot; to preview your mobile or webcam lens.
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
            {inputMethod === "upload" && !uploadedPreview && (
              <div className="p-4 w-100 position-relative" style={{ cursor: "pointer" }}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="position-absolute top-0 start-0 w-100 h-100 opacity-0"
                  style={{ cursor: "pointer" }}
                  disabled={isDetecting}
                />
                <div
                  className="p-4 rounded border-2 border-dashed border-success border-opacity-50 text-center"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}
                >
                  <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🖼️</div>
                  <h6 className="text-white fw-bold mb-1">Click to browse or Drag & Drop photo</h6>
                  <p className="text-secondary small mb-0">Supports JPEG, PNG, and WebP field captures</p>
                </div>
              </div>
            )}
          </div>

          {/* Camera & Photo Action Toolbar */}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 p-2 rounded wildlife-card">
            {inputMethod === "camera" ? (
              <>
                <div className="d-flex align-items-center gap-2">
                  {!isCameraActive ? (
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="btn btn-sm btn-wildlife-primary fw-semibold px-3 py-2 d-flex align-items-center gap-1"
                    >
                      <span>▶️ Start Camera</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="btn btn-sm btn-outline-danger px-3 py-2 fw-semibold d-flex align-items-center gap-1"
                      >
                        <span>⏹️ Stop Camera</span>
                      </button>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="btn btn-sm btn-wildlife-primary fw-bold px-3 py-2 d-flex align-items-center gap-1 shadow"
                      >
                        <span>📸 Capture Photo</span>
                      </button>
                    </>
                  )}

                  {/* Switch Camera Button for mobile devices */}
                  <button
                    type="button"
                    onClick={switchCamera}
                    className="btn btn-sm btn-wildlife-outline px-3 py-2 d-flex align-items-center gap-1"
                    title="Switch Front/Rear Camera"
                  >
                    <span>🔄 Switch ({facingMode === "environment" ? "Rear" : "Front"})</span>
                  </button>
                </div>

                {capturedPhoto && (
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="btn btn-sm btn-outline-light px-3 py-2 d-flex align-items-center gap-1"
                  >
                    <span>🔄 Retake</span>
                  </button>
                )}
              </>
            ) : (
              <div className="d-flex align-items-center gap-2 w-100 justify-content-between">
                <label className="btn btn-sm btn-wildlife-outline px-3 py-2 mb-0 d-flex align-items-center gap-2 cursor-pointer">
                  <span>📁 Change File</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="d-none"
                  />
                </label>
                {uploadedFile && (
                  <span className="small text-secondary text-truncate" style={{ maxWidth: "260px" }}>
                    {uploadedFile.name}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Camera Permission or Hardware Errors */}
          {cameraError && (
            <div className="wildlife-alert-danger mt-3 d-flex align-items-center gap-2">
              <span>⚠️</span>
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Right Side: Detection Trigger, Sanctuary Zone, & Results Card */}
        <div className="col-12 col-lg-5 d-flex flex-column justify-content-between">
          <div>
            {/* Zone & Parameter Settings */}
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

              {/* Main Detect Button */}
              <button
                type="button"
                onClick={handleDetect}
                disabled={isDetecting || (!capturedPhoto && !uploadedFile)}
                className="btn btn-wildlife-primary w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow"
              >
                {isDetecting ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Analyzing Wildlife...</span>
                  </>
                ) : (
                  <>
                    <span>⚡ Detect Animal</span>
                  </>
                )}
              </button>
            </div>

            {/* Detection Error */}
            {detectionError && (
              <div className="wildlife-alert-danger mb-3 d-flex align-items-center gap-2">
                <span>⚠️</span>
                <span>{detectionError}</span>
              </div>
            )}

            {/* Results Display */}
            {result ? (
              isUnknown ? (
                /* No Animal Detected State */
                <div
                  className="wildlife-card p-4 text-center"
                  style={{
                    backgroundColor: "rgba(30, 41, 59, 0.4)",
                    border: "1px dashed rgba(148, 163, 184, 0.4)",
                  }}
                >
                  <div style={{ fontSize: "2.8rem", marginBottom: "0.5rem" }}>🌿</div>
                  <h5 className="text-white fw-bold mb-1">No Animal Detected</h5>
                  <p className="text-secondary small mb-3">
                    The image was analyzed and no known wildlife species was detected with sufficient confidence.
                  </p>
                  <div className="badge bg-dark text-secondary border border-secondary p-2">
                    Confidence: 0.0% • Threshold: 40%
                  </div>
                </div>
              ) : (
                /* Animal Detected Card */
                <div
                  className="wildlife-card p-3"
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.45)",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                    <span className="badge-species d-flex align-items-center gap-1" style={{ fontSize: "0.9rem" }}>
                      <span>{getSpeciesIcon(result.species)}</span>
                      <span>{result.species}</span>
                    </span>
                    <span className="badge-confidence-high">
                      {Math.round((result.confidence || 0) * 100)}% Confidence
                    </span>
                  </div>

                  {/* Toggle between Overlay and Annotated view if available */}
                  {result.annotatedImage && (
                    <div className="d-flex justify-content-end mb-2">
                      <div className="btn-group btn-group-sm" role="group">
                        <button
                          type="button"
                          className={`btn btn-sm ${viewMode === "overlay" ? "btn-success" : "btn-dark border border-secondary text-secondary"}`}
                          onClick={() => setViewMode("overlay")}
                          style={{ fontSize: "0.72rem" }}
                        >
                          Bounding Box View
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${viewMode === "annotated" ? "btn-success" : "btn-dark border border-secondary text-secondary"}`}
                          onClick={() => setViewMode("annotated")}
                          style={{ fontSize: "0.72rem" }}
                        >
                          Annotated View
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Metadata List */}
                  <div className="small text-secondary pt-1">
                    <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                      <span>Species:</span>
                      <strong className="text-white">
                        {getSpeciesIcon(result.species)} {result.species}
                      </strong>
                    </div>
                    <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                      <span>Confidence:</span>
                      <strong className="text-success">
                        {(result.confidence * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                      <span>Sanctuary Zone:</span>
                      <span className="badge-zone">📍 {result.location || location}</span>
                    </div>
                    <div className="d-flex justify-content-between py-1 border-bottom border-secondary border-opacity-10">
                      <span>Timestamp:</span>
                      <span className="text-light">🕒 {result.timestamp}</span>
                    </div>
                    <div className="d-flex justify-content-between py-1">
                      <span>Total Identified:</span>
                      <span className="badge bg-dark text-info border border-secondary">
                        {result.total_detected || 1} Object(s)
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 mt-2 border-top border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                    <span className="small text-success d-flex align-items-center gap-1">
                      <span>✅</span>
                      <span>Saved to Detection Records</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        if (inputMethod === "camera") retakePhoto();
                      }}
                      className="btn btn-sm btn-outline-light py-1 px-2"
                      style={{ fontSize: "0.78rem" }}
                    >
                      New Capture
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* Awaiting Capture State */
              <div
                className="wildlife-card p-4 text-center d-flex flex-column align-items-center justify-content-center"
                style={{
                  minHeight: "200px",
                  border: "1px dashed var(--border-color)",
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                }}
              >
                <div style={{ fontSize: "2.4rem", marginBottom: "0.5rem" }}>🎯</div>
                <h6 className="text-white fw-semibold mb-1">Awaiting Photo Input</h6>
                <p className="text-secondary small mb-0" style={{ maxWidth: "280px" }}>
                  Capture a photo using the live camera or choose a file, then click &quot;Detect Animal&quot; to identify species.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
