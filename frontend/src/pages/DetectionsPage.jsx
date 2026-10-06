import { useState, useEffect, useMemo } from "react";
import detectionService from "../services/detectionService";
import PhotoDetection from "../components/detection/PhotoDetection";
import LiveDetection from "../components/detection/LiveDetection";
import VideoDetection from "../components/detection/VideoDetection";
import { getSpeciesIcon } from "../utils/speciesIcons";

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

  // Form states (Manual log)
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
  const [aiDetectionTab, setAiDetectionTab] = useState("photo"); // "photo" | "live" | "video"
  const [previewAnnotatedId, setPreviewAnnotatedId] = useState(null); // ID of record with annotated image view open

  // Callback when any detection saves to DB
  const handleDetectionSaved = (newRecord) => {
    if (!newRecord) return;
    setDetections((prev) => [newRecord, ...prev]);
    const confFormatted = Math.round((newRecord.confidence || 0) * 100);
    const timeInfo = newRecord.frameTimestamp ? ` at ${newRecord.frameTimestamp}` : "";
    setSuccessMsg(
      `Wildlife Sighting Logged: ${newRecord.species} (${confFormatted}% confidence)${timeInfo}! Successfully recorded in system.`
    );
    setTimeout(() => setSuccessMsg(""), 6000);
  };

  const loadDetections = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await detectionService.getAllDetections();
      setDetections(data);
    } catch (err) {
      setError(err.message || "Unable to load detection records. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await detectionService.getAllDetections();
        if (active) setDetections(data);
      } catch (err) {
        if (active) setError(err.message || "Unable to load detection records. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
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
        return (b.timestamp || "").localeCompare(a.timestamp || "");
      });
  }, [detections, searchQuery, speciesFilter, zoneFilter, sortBy]);

  return (
    <div className="container py-4">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row md-align-items-center justify-content-between gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <h2 className="text-white fw-bold mb-0">Wildlife Detections</h2>
            <span className="badge-species ms-2">
              <span className="status-pulse me-1"></span>
              {detections.length} Records
            </span>
          </div>
          <p className="text-secondary mb-0">
            Real-time wildlife surveillance: live camera streams, photo traps, and video observation logs.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAiPanel(!showAiPanel)}
            className="btn btn-wildlife-primary px-3 py-2 d-flex align-items-center gap-2 fw-semibold shadow-sm"
          >
            <span>{showAiPanel ? "✕ Hide Detection Suite" : "🔍 Open Detection Suite"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData((prev) => ({ ...prev, timestamp: formatCurrentDateTime() }));
              setShowAddForm(!showAddForm);
            }}
            className="btn btn-wildlife-outline px-3 py-2 d-flex align-items-center gap-2"
          >
            <span>{showAddForm ? "✕ Close Manual" : "+ Manual Sighting"}</span>
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

      {/* AI Wildlife Detection Suite Panel */}
      {showAiPanel && (
        <div
          className="wildlife-card p-4 mb-4"
          style={{
            border: "1px solid rgba(16, 185, 129, 0.45)",
            background: "linear-gradient(135deg, rgba(7, 17, 13, 0.96) 0%, rgba(19, 34, 28, 0.9) 100%)",
            boxShadow: "0 10px 36px rgba(0, 0, 0, 0.45)",
          }}
        >
          {/* Suite Navigation Tabs */}
          <div className="d-flex flex-wrap align-items-center justify-content-between pb-3 mb-3 border-bottom border-secondary border-opacity-25 gap-3">
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: "1.5rem" }}>🌿</span>
              <div>
                <h4 className="text-white fw-bold mb-0">Wildlife Detection Suite</h4>
                <div className="text-secondary small">
                  Switch between Photo Detection, Live Camera Feed, and Video Detection modes
                </div>
              </div>
            </div>

            {/* Mode Switcher Nav Pills */}
            <div className="btn-group shadow-sm" role="group">
              <button
                type="button"
                className={`btn btn-sm px-3 py-2 ${
                  aiDetectionTab === "photo"
                    ? "btn-wildlife-primary fw-bold"
                    : "btn-dark border border-secondary text-secondary"
                }`}
                onClick={() => setAiDetectionTab("photo")}
              >
                📸 Photo Detection
              </button>
              <button
                type="button"
                className={`btn btn-sm px-3 py-2 ${
                  aiDetectionTab === "live"
                    ? "btn-wildlife-primary fw-bold"
                    : "btn-dark border border-secondary text-secondary"
                }`}
                onClick={() => setAiDetectionTab("live")}
              >
                ⚡ Live Real-Time Feed
              </button>
              <button
                type="button"
                className={`btn btn-sm px-3 py-2 ${
                  aiDetectionTab === "video"
                    ? "btn-wildlife-primary fw-bold"
                    : "btn-dark border border-secondary text-secondary"
                }`}
                onClick={() => setAiDetectionTab("video")}
              >
                📹 Video Detection
              </button>
            </div>
          </div>

          {/* Active Tab View */}
          <div className="mt-2">
            {aiDetectionTab === "photo" && (
              <PhotoDetection onDetectionSaved={handleDetectionSaved} />
            )}
            {aiDetectionTab === "live" && (
              <LiveDetection onDetectionSaved={handleDetectionSaved} />
            )}
            {aiDetectionTab === "video" && (
              <VideoDetection onDetectionSaved={handleDetectionSaved} />
            )}
          </div>
        </div>
      )}

      {/* Manual Sighting Collapsible Form */}
      {showAddForm && (
        <div className="wildlife-card p-4 mb-4 border-success">
          <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom border-secondary border-opacity-25">
            <h5 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <span>🎯</span>
              <span>Log Manual Wildlife Observation</span>
            </h5>
            <span className="small text-secondary">Saves to detection records</span>
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
          <p className="text-secondary">Loading detection records...</p>
        </div>
      ) : filteredDetections.length === 0 ? (
        <div className="wildlife-card text-center py-5">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
          <h4 className="text-white">No Detection Records Found</h4>
          <p className="text-secondary mb-3">
            {detections.length === 0
              ? "No detection records found yet. Use the detection suite above to scan photos, live video, or recorded clips."
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
            const hasAnnotated = !!detection.annotatedImage;
            const isShowingAnnotated = previewAnnotatedId === detection._id;
            const imgSrc = isShowingAnnotated && hasAnnotated
              ? (detection.annotatedImage.startsWith("data:") ? detection.annotatedImage : `/uploads/${detection.annotatedImage}`)
              : `/uploads/${detection.image}`;

            return (
              <div key={detection._id} className="col-12 col-md-6 col-lg-4">
                <div className="wildlife-card p-3 h-100 d-flex flex-column justify-content-between position-relative">
                  <div>
                    {/* Card Top: Species & Confidence */}
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        <span className="badge-species d-flex align-items-center gap-1">
                          <span>{icon}</span>
                          <span>{detection.species}</span>
                        </span>
                        {(detection.mediaType === "video" || detection.frameTimestamp) && (
                          <span
                            className="badge bg-primary bg-opacity-25 text-info"
                            style={{ fontSize: "0.68rem" }}
                            title="Detected in video"
                          >
                            📹 Video
                          </span>
                        )}
                        {detection.boundingBoxes && detection.boundingBoxes.length > 0 && (
                          <span
                            className="badge bg-success bg-opacity-25 text-success"
                            style={{ fontSize: "0.68rem" }}
                            title={`${detection.boundingBoxes.length} Bounding Box(es)`}
                          >
                            🎯 {detection.boundingBoxes.length} Box
                          </span>
                        )}
                      </div>
                      <span className="badge-confidence-high">
                        {confPct}% Conf
                      </span>
                    </div>

                    {/* Animal Image / Icon Display */}
                    <div className="text-center py-2 position-relative">
                      {detection.image ? (
                        <div className="position-relative">
                          <img
                            src={imgSrc}
                            alt={detection.species}
                            className="img-fluid rounded mb-2 border border-secondary border-opacity-25 shadow-sm"
                            style={{ maxHeight: "170px", width: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const fallback = e.currentTarget.nextElementSibling;
                              if (fallback) fallback.style.display = "block";
                            }}
                          />
                          <div style={{ display: "none" }}>
                            <div style={{ fontSize: "3.2rem", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}>
                              {icon}
                            </div>
                            <div className="small text-white fw-semibold mt-1">
                              {detection.species}
                            </div>
                          </div>

                          {/* Annotated Toggle Pill */}
                          {hasAnnotated && (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewAnnotatedId(isShowingAnnotated ? null : detection._id)
                              }
                              className="position-absolute bottom-0 end-0 m-2 btn btn-xs btn-dark border border-success text-success px-2 py-0"
                              style={{ fontSize: "0.7rem", backgroundColor: "rgba(0, 0, 0, 0.75)" }}
                              title="Toggle Annotated Image View"
                            >
                              {isShowingAnnotated ? "Original" : "🔍 Annotated"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: "3.2rem", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}>
                            {icon}
                          </div>
                          <div className="small text-white fw-semibold mt-1">
                            {detection.species}
                          </div>
                        </div>
                      )}
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