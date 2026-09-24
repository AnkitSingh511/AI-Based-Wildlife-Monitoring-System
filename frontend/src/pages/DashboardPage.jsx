import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
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

function DashboardPage() {
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await detectionService.getAllDetections();
      setDetections(data);
    } catch (err) {
      setError(err.message || "Failed to load dashboard telemetry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Compute metrics
  const metrics = useMemo(() => {
    const total = detections.length;
    if (total === 0) {
      return {
        total: 0,
        avgConfidence: 0,
        highConfidenceCount: 0,
        distinctZones: 0,
        speciesCounts: {},
        topSpecies: [],
        recentDetections: [],
      };
    }

    const confSum = detections.reduce((sum, d) => sum + (d.confidence || 0), 0);
    const avgConfidence = Math.round((confSum / total) * 100);

    const highConfidenceCount = detections.filter(
      (d) => (d.confidence || 0) >= 0.8
    ).length;

    const zones = new Set(detections.map((d) => d.location).filter(Boolean));

    // Species distribution
    const speciesCounts = {};
    detections.forEach((d) => {
      const sp = d.species || "Unknown";
      speciesCounts[sp] = (speciesCounts[sp] || 0) + 1;
    });

    const topSpecies = Object.entries(speciesCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Recent 5 detections
    const recentDetections = [...detections]
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""))
      .slice(0, 5);

    return {
      total,
      avgConfidence,
      highConfidenceCount,
      distinctZones: zones.size,
      speciesCounts,
      topSpecies,
      recentDetections,
    };
  }, [detections]);

  return (
    <div className="container py-4">
      {/* Top Header */}
      <div className="d-flex flex-column flex-md-row md-align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="text-white fw-bold mb-1">Monitoring Dashboard</h2>
          <p className="text-secondary mb-0">
            System metrics and detection surveillance feed overview.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="badge-species">
            <span className="status-pulse me-1"></span>
            Live Telemetry
          </span>
          <button
            type="button"
            onClick={loadDashboardData}
            className="btn btn-wildlife-outline px-3 py-1"
            title="Refresh dashboard data"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="wildlife-alert-danger mb-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadDashboardData}
            className="btn btn-sm btn-outline-light"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success mb-3" role="status"></div>
          <p className="text-secondary">Aggregating telemetry from database...</p>
        </div>
      ) : (
        <>
          {/* 4 Metric Summary Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3">
              <div className="wildlife-card p-3 h-100">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="small text-secondary fw-semibold">Total Sightings</span>
                  <span style={{ fontSize: "1.3rem" }}>📡</span>
                </div>
                <div className="h2 text-white fw-bold mb-1">{metrics.total}</div>
                <div className="small text-secondary">Recorded in database</div>
              </div>
            </div>

            <div className="col-6 col-lg-3">
              <div className="wildlife-card p-3 h-100">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="small text-secondary fw-semibold">Avg Confidence</span>
                  <span style={{ fontSize: "1.3rem" }}>🎯</span>
                </div>
                <div className="h2 text-white fw-bold mb-1">{metrics.avgConfidence}%</div>
                <div className="small text-secondary">Neural model accuracy</div>
              </div>
            </div>

            <div className="col-6 col-lg-3">
              <div className="wildlife-card p-3 h-100">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="small text-secondary fw-semibold">High Confidence</span>
                  <span style={{ fontSize: "1.3rem" }}>⚡</span>
                </div>
                <div className="h2 text-white fw-bold mb-1">{metrics.highConfidenceCount}</div>
                <div className="small text-secondary">Sightings &gt; 80% confidence</div>
              </div>
            </div>

            <div className="col-6 col-lg-3">
              <div className="wildlife-card p-3 h-100">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="small text-secondary fw-semibold">Active Zones</span>
                  <span style={{ fontSize: "1.3rem" }}>📍</span>
                </div>
                <div className="h2 text-white fw-bold mb-1">{metrics.distinctZones}</div>
                <div className="small text-secondary">Monitored quadrants</div>
              </div>
            </div>
          </div>

          {/* Main Content: Species Breakdown & Recent Activity */}
          <div className="row g-4 mb-4">
            {/* Species Distribution */}
            <div className="col-12 col-lg-6">
              <div className="wildlife-card p-4 h-100">
                <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-secondary border-opacity-25">
                  <h5 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                    <span>🐾</span>
                    <span>Species Distribution</span>
                  </h5>
                  <span className="small text-secondary">{metrics.topSpecies.length} Unique Species</span>
                </div>

                {metrics.topSpecies.length === 0 ? (
                  <p className="text-secondary small">No species records available.</p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {metrics.topSpecies.map((sp) => {
                      const icon = getSpeciesIcon(sp.name);
                      return (
                        <div key={sp.name}>
                          <div className="d-flex justify-content-between align-items-center small mb-1">
                            <span className="text-white fw-semibold d-flex align-items-center gap-2">
                              <span>{icon}</span>
                              <span>{sp.name}</span>
                            </span>
                            <span className="text-secondary">
                              {sp.count} sightings ({sp.percentage}%)
                            </span>
                          </div>
                          <div
                            className="progress"
                            style={{
                              height: "8px",
                              backgroundColor: "rgba(255, 255, 255, 0.15)",
                              borderRadius: "4px",
                            }}
                          >
                            <div
                              className="progress-bar"
                              style={{
                                width: `${sp.percentage}%`,
                                backgroundColor: "var(--primary)",
                                borderRadius: "4px",
                              }}
                              role="progressbar"
                              aria-valuenow={sp.percentage}
                              aria-valuemin="0"
                              aria-valuemax="100"
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Sightings Feed */}
            <div className="col-12 col-lg-6">
              <div className="wildlife-card p-4 h-100">
                <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-secondary border-opacity-25">
                  <h5 className="text-white fw-bold mb-0 d-flex align-items-center gap-2">
                    <span>🕒</span>
                    <span>Recent Activity</span>
                  </h5>
                  <Link
                    to="/detections"
                    className="small fw-semibold"
                    style={{ color: "var(--accent)" }}
                  >
                    View All →
                  </Link>
                </div>

                {metrics.recentDetections.length === 0 ? (
                  <p className="text-secondary small">No sightings logged yet.</p>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {metrics.recentDetections.map((detection) => {
                      const icon = getSpeciesIcon(detection.species);
                      const confPct = Math.round((detection.confidence || 0) * 100);

                      return (
                        <div
                          key={detection._id}
                          className="d-flex align-items-center justify-content-between p-2 rounded"
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <span style={{ fontSize: "1.8rem" }}>{icon}</span>
                            <div>
                              <div className="d-flex align-items-center gap-1">
                                <span className="text-white fw-semibold small">
                                  {detection.species}
                                </span>
                                {(detection.mediaType === "video" || detection.frameTimestamp) && (
                                  <span className="badge bg-primary bg-opacity-25 text-info" style={{ fontSize: "0.65rem" }} title="Detected in video">
                                    📹 {detection.frameTimestamp || "Video"}
                                  </span>
                                )}
                              </div>
                              <div className="small text-secondary" style={{ fontSize: "0.75rem" }}>
                                {detection.timestamp}
                              </div>
                            </div>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <span className="badge-zone" style={{ fontSize: "0.72rem" }}>
                              📍 {detection.location}
                            </span>
                            <span className="badge-confidence-high" style={{ fontSize: "0.72rem" }}>
                              {confPct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Neural Engine & Server Status */}
          <div
            className="wildlife-card p-3 d-flex flex-column flex-md-row align-items-center justify-content-between gap-2"
            style={{
              background: "linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(7, 17, 13, 0.4) 100%)",
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <span className="status-pulse"></span>
              <span className="small text-white fw-semibold">
                Wildlife Guard Backend & Telemetry Pipeline Online
              </span>
            </div>
            <div className="d-flex align-items-center gap-3 small text-secondary">
              <span>Database: <code className="text-success">Connected</code></span>
              <span>Port: <code className="text-light">5000</code></span>
              <Link to="/detections" className="btn btn-sm btn-wildlife-primary py-1 px-3">
                Log New Sighting
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPage;