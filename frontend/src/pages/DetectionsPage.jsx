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
            onClick={() => {
              setFormData((prev) => ({ ...prev, timestamp: formatCurrentDateTime() }));
              setShowAddForm(!showAddForm);
            }}
            className="btn btn-wildlife-primary px-3 py-2 d-flex align-items-center gap-2 fw-semibold"
          >
            <span>{showAddForm ? "✕ Close Form" : "+ Log Sighting"}</span>
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
                      <span className="badge-species d-flex align-items-center gap-1">
                        <span>{icon}</span>
                        <span>{detection.species}</span>
                      </span>
                      <span className="badge-confidence-high">
                        {confPct}% Conf
                      </span>
                    </div>

                    {/* Animal Icon Display */}
                    <div className="text-center py-3">
                      <div style={{ fontSize: "3.2rem", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}>
                        {icon}
                      </div>
                      <div className="small text-white fw-semibold mt-1">
                        {detection.species}
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
                      <div className="d-flex justify-content-between align-items-center text-truncate">
                        <span>File:</span>
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