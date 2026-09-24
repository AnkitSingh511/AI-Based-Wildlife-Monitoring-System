import { useState, useEffect, useMemo } from "react";
import detectionService from "../services/detectionService";

const SPECIES_ICONS = {
  Tiger: "🐅",
  Elephant: "🐘",
  Deer: "🦌",
  Leopard: "🐆",
  "Wild Boar": "🐗",
  Peacock: "🦚",
  Jackal: "🐺",
};

function getSpeciesIcon(species) {
  if (!species) return "🐾";
  const match = Object.keys(SPECIES_ICONS).find(
    (key) => key.toLowerCase() === species.toLowerCase()
  );
  return match ? SPECIES_ICONS[match] : "🐾";
}

function formatCurrentDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function DetectionsPage() {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({
    species: "",
    confidence: "90",
    location: "Zone A",
    timestamp: formatCurrentDateTime(),
    image: "",
  });

  // AI Wildlife Detection states
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [mediaMode, setMediaMode] = useState("image"); // "image" | "video"
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [aiLocation, setAiLocation] = useState("Zone A");
  const [isDetecting, setIsDetecting] = useState(false);
  const [aiError, setAiError] = useState("");
  const [detectionResult, setDetectionResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setAiError("");
    setDetectionResult(null);
    if (!file) return;

    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|avi|mov|mkv)$/i.test(file.name);
    const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);

    if (mediaMode === "video" && !isVideo) {
      setAiError("Please select a valid video file (MP4, WebM, AVI, MOV, or MKV).");
      return;
    }
    if (mediaMode === "image" && !isImage) {
      if (isVideo) {
        // Auto-switch to video mode if user dropped a video
        setMediaMode("video");
      } else {
        setAiError("Please select a valid image file (JPEG, PNG, or WebP).");
        return;
      }
    }

    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  };

  const handleClearAi = () => {
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setFilePreview(null);
    setAiError("");
    setDetectionResult(null);
  };

  const handleAiDetect = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setAiError(`Please choose or drag-and-drop a wildlife ${mediaMode === "video" ? "video" : "image"} first.`);
      return;
    }

    try {
      setIsDetecting(true);
      setAiError("");
      setDetectionResult(null);

      const data = new FormData();
      data.append("location", aiLocation);
      data.append("timestamp", formatCurrentDateTime());

      let newRecord;
      if (mediaMode === "video") {
        data.append("video", selectedFile);
        newRecord = await detectionService.uploadAndDetectVideo(data);
      } else {
        data.append("image", selectedFile);
        newRecord = await detectionService.uploadAndDetect(data);
      }

      setDetectionResult(newRecord);
      setDetections((prev) => [newRecord, ...prev]);
      const confFormatted = Math.round((newRecord.confidence || 0) * 100);
      const timeInfo = newRecord.frameTimestamp ? ` at ${newRecord.frameTimestamp}` : "";
      setSuccessMsg(
        `Wildlife Detected: ${newRecord.species} (${confFormatted}% confidence)${timeInfo}! Successfully stored in MongoDB.`
      );
      setTimeout(() => setSuccessMsg(""), 6000);
    } catch (err) {
      setAiError(err.message || `${mediaMode === "video" ? "Video" : "Image"} detection failed or no animal identified.`);
    } finally {
      setIsDetecting(false);
    }
  };

  const loadDetections = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await detectionService.getAllDetections();
      setDetections(data);
    } catch (err) {
      setError(err.message || "Failed to load detection records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetections();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formData.species.trim()) {
      setFormError("Species name is required.");
      return;
    }
    if (!formData.location.trim()) {
      setFormError("Location is required.");
      return;
    }

    const confNum = parseFloat(formData.confidence);
    if (isNaN(confNum) || confNum < 0 || confNum > 100) {
      setFormError("Confidence must be a percentage between 0 and 100.");
      return;
    }

    // Backend model requires confidence between 0 and 1
    const normalizedConfidence = +(confNum > 1 ? (confNum / 100).toFixed(2) : confNum);

    const timestampRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    const formattedTimestamp = formData.timestamp.trim() || formatCurrentDateTime();
    if (!timestampRegex.test(formattedTimestamp)) {
      setFormError("Timestamp must match format YYYY-MM-DD HH:MM (e.g. 2026-09-22 14:30)");
      return;
    }

    const imageFilename = formData.image.trim() || `${formData.species.toLowerCase().replace(/\s+/g, "_")}_01.jpg`;

    try {
      setFormSubmitting(true);
      const newRecord = await detectionService.createDetection({
        species: formData.species.trim(),
        confidence: normalizedConfidence,
        location: formData.location.trim(),
        timestamp: formattedTimestamp,
        image: imageFilename,
      });

      setDetections((prev) => [newRecord, ...prev]);
      setSuccessMsg(`Logged sighting for ${formData.species} successfully!`);
      setTimeout(() => setSuccessMsg(""), 4000);

      // Reset form
      setFormData({
        species: "",
        confidence: "90",
        location: "Zone A",
        timestamp: formatCurrentDateTime(),
        image: "",
      });
      setShowAddForm(false);
    } catch (err) {
      setFormError(err.message || "Failed to create detection record.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id, species) => {
    if (!window.confirm(`Are you sure you want to delete this ${species} detection record?`)) {
      return;
    }

    try {
      await detectionService.deleteDetection(id);
      setDetections((prev) => prev.filter((d) => d._id !== id));
      setSuccessMsg("Detection record deleted successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      alert(err.message || "Failed to delete record.");
    }
  };

  // Distinct species for filter dropdown
  const uniqueSpecies = useMemo(() => {
    const list = Array.from(new Set(detections.map((d) => d.species).filter(Boolean)));
    return list.sort();
  }, [detections]);

  // Distinct zones for filter dropdown
  const uniqueZones = useMemo(() => {
    const list = Array.from(new Set(detections.map((d) => d.location).filter(Boolean)));
    return list.sort();
  }, [detections]);

  // Filtered and sorted detections
  const filteredDetections = useMemo(() => {
    return detections
      .filter((d) => {
        const matchesSearch =
          !searchQuery ||
          d.species?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.image?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesSpecies =
          speciesFilter === "all" ||
          d.species?.toLowerCase() === speciesFilter.toLowerCase();

        const matchesZone =
          zoneFilter === "all" ||
          d.location?.toLowerCase() === zoneFilter.toLowerCase();

        return matchesSearch && matchesSpecies && matchesZone;
      })
      .sort((a, b) => {
        if (sortBy === "confidence-high") return (b.confidence || 0) - (a.confidence || 0);
        if (sortBy === "confidence-low") return (a.confidence || 0) - (b.confidence || 0);
        // Default newest first (by timestamp or _id)
        return (b.timestamp || "").localeCompare(a.timestamp || "");
      });
  }, [detections, searchQuery, speciesFilter, zoneFilter, sortBy]);

  return (
    <div className="container py-4">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row md-align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h2 className="text-white fw-bold mb-0">Detection Records</h2>
            <span className="badge-species ms-2">
              <span className="status-pulse me-1"></span>
              {detections.length} Total
            </span>
          </div>
          <p className="text-secondary mb-0">
            Surveillance logs filtered by species, confidence ratings, and sanctuary zones.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAiPanel(!showAiPanel)}
            className="btn btn-wildlife-primary px-3 py-2 d-flex align-items-center gap-2 fw-semibold"
          >
            <span>{showAiPanel ? "✕ Hide AI Detector" : "🤖 AI Image Detector"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData((prev) => ({ ...prev, timestamp: formatCurrentDateTime() }));
              setShowAddForm(!showAddForm);
            }}
            className="btn btn-wildlife-outline px-3 py-2 d-flex align-items-center gap-2"
          >
            <span>{showAddForm ? "✕ Close Manual" : "+ Manual Log"}</span>
          </button>
          <button
            type="button"
            onClick={loadDetections}
            className="btn btn-wildlife-outline px-3 py-2"
            title="Refresh records"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Success Alert */}
      {successMsg && (
        <div className="wildlife-alert-success mb-4 d-flex align-items-center gap-2">
          <span>✅</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="wildlife-alert-danger mb-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadDetections}
            className="btn btn-sm btn-outline-light"
          >
            Retry
          </button>
        </div>
      )}

      {/* AI Wildlife Image Detection & Sighting Panel */}
      {showAiPanel && (
        <div className="wildlife-card p-4 mb-4" style={{
          border: '1px solid rgba(16, 185, 129, 0.4)',
          background: 'linear-gradient(135deg, rgba(7, 17, 13, 0.95) 0%, rgba(19, 34, 28, 0.85) 100%)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between pb-3 mb-3 border-bottom border-secondary border-opacity-25 gap-2">
            <div>
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '1.4rem' }}>{mediaMode === "video" ? "📹" : "🐍"}</span>
                <h4 className="text-white fw-bold mb-0">
                  {mediaMode === "video" ? "PyTorch Wildlife Video Detection" : "PyTorch Wildlife Neural Detection"}
                </h4>
                <span className="badge-species py-1 px-2" style={{ fontSize: '0.72rem' }}>
                  <span className="status-pulse me-1"></span> Live AI
                </span>
              </div>
              <p className="text-secondary small mb-0 mt-1">
                {mediaMode === "video"
                  ? "Upload a wildlife video. The Python AI service samples frames, detects wildlife species, deduplicates sightings, and saves the sightings."
                  : "Upload a camera trap capture. The Node backend spawns the PyTorch detection engine, verifies species labels, and records the sighting to MongoDB."}
              </p>
            </div>
            <span className="small text-secondary">
              Flow: React → Node.js → Python PyTorch → MongoDB
            </span>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="d-flex align-items-center gap-2 mb-3">
            <span className="small text-secondary fw-semibold">Media Type:</span>
            <div className="btn-group" role="group">
              <button
                type="button"
                className={`btn btn-sm ${mediaMode === "image" ? "btn-wildlife-primary fw-bold" : "btn-dark border border-secondary text-secondary"}`}
                onClick={() => {
                  setMediaMode("image");
                  handleClearAi();
                }}
                disabled={isDetecting}
              >
                📷 Image Detection
              </button>
              <button
                type="button"
                className={`btn btn-sm ${mediaMode === "video" ? "btn-wildlife-primary fw-bold" : "btn-dark border border-secondary text-secondary"}`}
                onClick={() => {
                  setMediaMode("video");
                  handleClearAi();
                }}
                disabled={isDetecting}
              >
                📹 Video Detection
              </button>
            </div>
          </div>

          <div className="row g-4 align-items-stretch">
            {/* Left Column: Upload & Configuration Form */}
            <div className="col-12 col-lg-6 d-flex flex-column justify-content-between">
              <form onSubmit={handleAiDetect}>
                <div className="mb-3">
                  <label className="small text-secondary fw-semibold mb-2 d-block">
                    {mediaMode === "video"
                      ? "Select Wildlife Camera Video (MP4, WebM, AVI, MOV, MKV up to 100MB) *"
                      : "Select Wildlife Camera Image (JPEG, PNG, WebP) *"}
                  </label>
                  <div
                    className="p-3 rounded text-center position-relative"
                    style={{
                      border: "2px dashed rgba(16, 185, 129, 0.4)",
                      backgroundColor: "rgba(0, 0, 0, 0.2)",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <input
                      type="file"
                      id="wildlife-file-input"
                      accept={
                        mediaMode === "video"
                          ? "video/mp4,video/webm,video/x-msvideo,video/quicktime,video/x-matroska,.mp4,.webm,.avi,.mov,.mkv"
                          : "image/jpeg,image/png,image/webp"
                      }
                      onChange={handleFileChange}
                      className="position-absolute top-0 start-0 w-100 h-100 opacity-0"
                      style={{ cursor: "pointer" }}
                      disabled={isDetecting}
                    />
                    {filePreview ? (
                      <div className="d-flex align-items-center justify-content-center gap-3">
                        {mediaMode === "video" ? (
                          <video
                            src={filePreview}
                            className="rounded"
                            style={{ width: "90px", height: "70px", objectFit: "cover" }}
                            muted
                          />
                        ) : (
                          <img
                            src={filePreview}
                            alt="Selected preview"
                            className="rounded"
                            style={{ width: "70px", height: "70px", objectFit: "cover" }}
                          />
                        )}
                        <div className="text-start">
                          <div className="text-white fw-semibold small text-truncate" style={{ maxWidth: "220px" }}>
                            {selectedFile?.name}
                          </div>
                          <div className="small text-secondary">
                            {selectedFile?.size > 1024 * 1024
                              ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                              : `${(selectedFile?.size / 1024).toFixed(1)} KB`} • Ready for detection
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearAi();
                            }}
                            className="btn btn-sm btn-link text-danger p-0 mt-1"
                            style={{ textDecoration: "none", fontSize: "0.8rem" }}
                          >
                            ✕ Remove / Choose other
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-3">
                        <div style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>
                          {mediaMode === "video" ? "📹" : "📷"}
                        </div>
                        <div className="text-white fw-semibold small">
                          {mediaMode === "video"
                            ? "Click to browse or drag & drop wildlife video"
                            : "Click to browse or drag & drop wildlife image"}
                        </div>
                        <div className="text-secondary small mt-1">
                          {mediaMode === "video"
                            ? "Supports trap camera clips, motion footage, and field recordings"
                            : "Supports camera trap stills and field photography"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6">
                    <label className="small text-secondary fw-semibold mb-1 d-block">
                      Sanctuary Zone / Location *
                    </label>
                    <select
                      className="wildlife-select"
                      value={aiLocation}
                      onChange={(e) => setAiLocation(e.target.value)}
                      disabled={isDetecting}
                    >
                      <option value="Zone A">📍 Zone A (Core Habitat)</option>
                      <option value="Zone B">📍 Zone B (Buffer Forest)</option>
                      <option value="Zone C">📍 Zone C (Water Reservoir)</option>
                      <option value="North Ridge">📍 North Ridge Corridor</option>
                      <option value="East Grassland">📍 East Grassland</option>
                    </select>
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="small text-secondary fw-semibold mb-1 d-block">
                      Telemetry Timestamp
                    </label>
                    <input
                      type="text"
                      className="wildlife-input"
                      value={formatCurrentDateTime()}
                      disabled
                      readOnly
                      title="Timestamp recorded automatically at inference time"
                    />
                  </div>
                </div>

                {aiError && (
                  <div className="wildlife-alert-danger mb-3 d-flex align-items-center gap-2">
                    <span>⚠️</span>
                    <span>{aiError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isDetecting || !selectedFile}
                  className="btn btn-wildlife-primary w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow"
                >
                  {isDetecting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>
                        {mediaMode === "video"
                          ? "Analyzing Video Frames with PyTorch YOLO..."
                          : "Detecting Wildlife with PyTorch..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        {mediaMode === "video"
                          ? "⚡ Run PyTorch Video AI Detection"
                          : "⚡ Run PyTorch AI Detection"}
                      </span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right Column: Real-time Detection Result Card */}
            <div className="col-12 col-lg-6">
              {detectionResult ? (
                <div
                  className="p-3 rounded h-100 d-flex flex-column justify-content-between"
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                  }}
                >
                  <div>
                    {/* Header */}
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-secondary border-opacity-25">
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge-species d-flex align-items-center gap-1">
                          <span>{getSpeciesIcon(detectionResult.species)}</span>
                          <span>{detectionResult.species}</span>
                        </span>
                        {detectionResult.mediaType === "video" && (
                          <span className="badge bg-primary bg-opacity-25 text-info" style={{ fontSize: "0.72rem" }}>
                            📹 Video
                          </span>
                        )}
                      </div>
                      <span className="badge-confidence-high">
                        {Math.round((detectionResult.confidence || 0) * 100)}% Confidence
                      </span>
                    </div>

                    {/* Image / Thumbnail Display */}
                    <div className="text-center mb-3">
                      <img
                        src={`/uploads/${detectionResult.image}`}
                        alt={detectionResult.species}
                        className="img-fluid rounded border border-success border-opacity-50 shadow-sm"
                        style={{ maxHeight: "200px", width: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          if (filePreview && mediaMode === "image") e.target.src = filePreview;
                        }}
                      />
                      {detectionResult.frameTimestamp && (
                        <div className="small text-secondary mt-1">
                          Snapshot captured at video frame: <span className="text-warning fw-semibold">{detectionResult.frameTimestamp}</span>
                        </div>
                      )}
                    </div>

                    {/* Details Table */}
                    <div className="small text-secondary pt-2 border-top border-secondary border-opacity-25">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-semibold">Detected Species:</span>
                        <span className="text-white fw-bold">
                          {getSpeciesIcon(detectionResult.species)} {detectionResult.species}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-semibold">Confidence Rating:</span>
                        <span className="text-success fw-bold">
                          {(detectionResult.confidence * 100).toFixed(1)}% ({detectionResult.confidence})
                        </span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-semibold">Sanctuary Zone:</span>
                        <span className="badge-zone">📍 {detectionResult.location}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="fw-semibold">Timestamp:</span>
                        <span className="text-light">🕒 {detectionResult.timestamp}</span>
                      </div>

                      {detectionResult.frameTimestamp && (
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-semibold">Frame Timestamp:</span>
                          <span className="text-warning fw-bold">⏱️ {detectionResult.frameTimestamp}</span>
                        </div>
                      )}

                      {detectionResult.video && (
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-semibold">Source Video:</span>
                          <code className="text-secondary small text-truncate" style={{ maxWidth: "200px" }}>
                            {detectionResult.video}
                          </code>
                        </div>
                      )}

                      <div className="d-flex justify-content-between align-items-center">
                        <span className="fw-semibold">Snapshot Saved:</span>
                        <code className="text-secondary small text-truncate" style={{ maxWidth: "200px" }}>
                          {detectionResult.image}
                        </code>
                      </div>

                      {/* Video Sightings Breakdown */}
                      {detectionResult.videoDetections && detectionResult.videoDetections.length > 1 && (
                        <div className="mt-2 pt-2 border-top border-secondary border-opacity-25">
                          <span className="small text-secondary fw-semibold d-block mb-1">
                            All Detections in Video ({detectionResult.videoDetections.length}):
                          </span>
                          <div className="d-flex flex-wrap gap-1" style={{ maxHeight: "80px", overflowY: "auto" }}>
                            {detectionResult.videoDetections.map((vd, i) => (
                              <span
                                key={i}
                                className="badge bg-dark border border-secondary text-light p-1"
                                style={{ fontSize: "0.72rem" }}
                              >
                                {getSpeciesIcon(vd.species)} {vd.species} ({Math.round(vd.confidence * 100)}%) @ {vd.frameTimestamp}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center pt-3 mt-2 border-top border-secondary border-opacity-25">
                    <span className="small text-success d-flex align-items-center gap-1">
                      <span>✅</span>
                      <span>Saved in MongoDB (ID: {detectionResult._id?.slice(-6) || "Done"})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAi}
                      className="btn btn-sm btn-outline-light py-1 px-2"
                      style={{ fontSize: "0.8rem" }}
                    >
                      New Scan
                    </button>
                  </div>
                </div>
              ) : isDetecting ? (
                <div className="h-100 rounded p-4 d-flex flex-column align-items-center justify-content-center text-center" style={{
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                  border: "1px dashed rgba(16, 185, 129, 0.3)"
                }}>
                  <div className="spinner-border text-success mb-3" style={{ width: "3rem", height: "3rem" }} role="status"></div>
                  <h5 className="text-white fw-bold mb-2">
                    {mediaMode === "video" ? "Analyzing Video with PyTorch YOLO" : "Analyzing Image with PyTorch"}
                  </h5>
                  <p className="text-secondary small mb-2" style={{ maxWidth: "340px" }}>
                    {mediaMode === "video"
                      ? "Sampling video frames, running neural forward pass, deduplicating wildlife sightings, and generating snapshot thumbnails..."
                      : "Node.js backend has spawned the Python detection service. Evaluating YOLO tensor forward pass..."}
                  </p>
                  <div className="badge-species py-1 px-3">
                    <span className="status-pulse me-1"></span> {mediaMode === "video" ? "Processing Video Frames" : "Processing Bounding Boxes"}
                  </div>
                </div>
              ) : (
                <div className="h-100 rounded p-4 d-flex flex-column align-items-center justify-content-center text-center" style={{
                  backgroundColor: "rgba(0, 0, 0, 0.15)",
                  border: "1px dashed var(--border-color)"
                }}>
                  <div style={{ fontSize: "2.8rem", marginBottom: "0.8rem" }}>🎯</div>
                  <h5 className="text-white fw-semibold mb-1">Awaiting Image Upload</h5>
                  <p className="text-secondary small mb-0" style={{ maxWidth: "340px" }}>
                    Select an image file on the left and click &quot;Run PyTorch AI Detection&quot;. The actual species, confidence, zone, and timestamp will be displayed here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Sighting Collapsible Form */}
      {showAddForm && (
        <div className="wildlife-card p-4 mb-4 border-success">
          <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-secondary border-opacity-25">
            <h5 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <span>🎯</span>
              <span>Log New Wildlife Detection</span>
            </h5>
            <span className="small text-secondary">Transmits to backend MongoDB</span>
          </div>

          {formError && (
            <div className="wildlife-alert-danger mb-3 d-flex align-items-center gap-2">
              <span>⚠️</span>
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleAddSubmit}>
            <div className="row g-3">
              <div className="col-12 col-md-4">
                <label className="small text-secondary fw-semibold mb-1 d-block">
                  Species Name *
                </label>
                <input
                  type="text"
                  name="species"
                  className="wildlife-input"
                  placeholder="e.g. Tiger, Elephant, Leopard"
                  value={formData.species}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="small text-secondary fw-semibold mb-1 d-block">
                  Confidence Score (% or 0-1) *
                </label>
                <input
                  type="number"
                  step="any"
                  name="confidence"
                  className="wildlife-input"
                  placeholder="e.g. 94 or 0.94"
                  value={formData.confidence}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="col-12 col-md-4">
                <label className="small text-secondary fw-semibold mb-1 d-block">
                  Sanctuary Zone / Location *
                </label>
                <input
                  type="text"
                  name="location"
                  className="wildlife-input"
                  placeholder="e.g. Zone A, Water Reservoir"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="small text-secondary fw-semibold mb-1 d-block">
                  Timestamp (YYYY-MM-DD HH:MM) *
                </label>
                <input
                  type="text"
                  name="timestamp"
                  className="wildlife-input"
                  placeholder="2026-09-22 14:30"
                  value={formData.timestamp}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="small text-secondary fw-semibold mb-1 d-block">
                  Image / Camera Stream ID
                </label>
                <input
                  type="text"
                  name="image"
                  className="wildlife-input"
                  placeholder="e.g. cam01_tiger_capture.jpg"
                  value={formData.image}
                  onChange={handleInputChange}
                />
              </div>

              <div className="col-12 d-flex justify-content-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn btn-dark border border-secondary text-secondary px-3"
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-wildlife-primary px-4 fw-semibold d-flex align-items-center gap-2"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Detection</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="wildlife-card p-3 mb-4">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-4">
            <div className="position-relative">
              <input
                type="text"
                className="wildlife-input"
                placeholder="🔍 Search species, zone, file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="btn btn-sm text-secondary position-absolute end-0 top-50 translate-middle-y me-2"
                  style={{ border: "none", background: "none" }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="col-6 col-md-3">
            <select
              className="wildlife-select"
              value={speciesFilter}
              onChange={(e) => setSpeciesFilter(e.target.value)}
            >
              <option value="all">🐾 All Species</option>
              {uniqueSpecies.map((sp) => (
                <option key={sp} value={sp}>
                  {getSpeciesIcon(sp)} {sp}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <select
              className="wildlife-select"
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
            >
              <option value="all">📍 All Zones</option>
              {uniqueZones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-2">
            <select
              className="wildlife-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">🕒 Newest</option>
              <option value="confidence-high">📈 High Conf</option>
              <option value="confidence-low">📉 Low Conf</option>
            </select>
          </div>
        </div>
      </div>

      {/* Detection Cards Feed */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success mb-3" role="status"></div>
          <p className="text-secondary">Loading telemetry records from database...</p>
        </div>
      ) : filteredDetections.length === 0 ? (
        <div className="wildlife-card text-center py-5">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
          <h4 className="text-white">No Detection Records Found</h4>
          <p className="text-secondary mb-3">
            {detections.length === 0
              ? "The database has no detection logs yet. Click 'Log Sighting' to add one."
              : "No records match the current filter criteria."}
          </p>
          {(searchQuery || speciesFilter !== "all" || zoneFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSpeciesFilter("all");
                setZoneFilter("all");
              }}
              className="btn btn-wildlife-outline px-3 py-2"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="row g-3">
          {filteredDetections.map((detection) => {
            const confPct = Math.round((detection.confidence || 0) * 100);
            const icon = getSpeciesIcon(detection.species);

            return (
              <div key={detection._id} className="col-12 col-md-6 col-lg-4">
                <div className="wildlife-card p-3 h-100 d-flex flex-column justify-content-between position-relative">
                  <div>
                    {/* Card Top: Species & Confidence */}
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="d-flex align-items-center gap-1">
                        <span className="badge-species d-flex align-items-center gap-1">
                          <span>{icon}</span>
                          <span>{detection.species}</span>
                        </span>
                        {(detection.mediaType === "video" || detection.frameTimestamp) && (
                          <span className="badge bg-primary bg-opacity-25 text-info" style={{ fontSize: "0.68rem" }} title="Detected in video">
                            📹 Video
                          </span>
                        )}
                      </div>
                      <span className="badge-confidence-high">
                        {confPct}% Conf
                      </span>
                    </div>

                    {/* Animal Image / Icon Display */}
                    <div className="text-center py-2">
                      {detection.image && (
                        <img
                          src={`/uploads/${detection.image}`}
                          alt={detection.species}
                          className="img-fluid rounded mb-2 border border-secondary border-opacity-25"
                          style={{ maxHeight: "150px", width: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.style.display = "block";
                          }}
                        />
                      )}
                      <div style={{ display: detection.image ? "none" : "block" }}>
                        <div style={{ fontSize: "3.2rem", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}>
                          {icon}
                        </div>
                        <div className="small text-white fw-semibold mt-1">
                          {detection.species}
                        </div>
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="small text-secondary pt-2 border-top border-secondary border-opacity-25">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span>Zone:</span>
                        <span className="badge-zone">📍 {detection.location}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span>Timestamp:</span>
                        <span className="text-light">{detection.timestamp}</span>
                      </div>
                      {detection.frameTimestamp && (
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span>Frame Time:</span>
                          <span className="text-warning fw-semibold">⏱️ {detection.frameTimestamp}</span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between align-items-center text-truncate">
                        <span>{detection.mediaType === "video" ? "Thumbnail:" : "File:"}</span>
                        <code className="text-secondary small text-truncate" style={{ maxWidth: "160px" }}>
                          {detection.image || "live_stream.jpg"}
                        </code>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Delete Action */}
                  <div className="d-flex justify-content-between align-items-center pt-3 mt-2 border-top border-secondary border-opacity-10">
                    <span className="small text-muted" style={{ fontSize: "0.75rem" }}>
                      ID: {detection._id?.slice(-6)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(detection._id, detection.species)}
                      className="btn btn-sm btn-outline-danger py-0 px-2"
                      style={{ fontSize: "0.8rem", borderRadius: "6px" }}
                      title="Delete record"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DetectionsPage;