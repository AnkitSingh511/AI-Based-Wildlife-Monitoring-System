
/* ==========================================================================
   4. LANDING PAGE VIEW (STEP 5)
   ========================================================================== */


   import { Link } from "react-router-dom";
function LandingPage() {
  // Standard Sample Detection Data
  const sampleDetection = {
    species: "Tiger",
    confidence: 0.94,
    location: "Zone A",
    timestamp: "2026-09-20 10:30",
    image: "tiger.jpg"
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="py-5" style={{
        background: 'radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 70%)'
      }}>
        <div className="container py-4">
          <div className="row align-items-center gy-5">
            {/* Left Column */}
            <div className="col-12 col-lg-7 text-center text-lg-start">
              <div className="d-inline-flex align-items-center gap-2 mb-3 px-3 py-1 rounded-pill" style={{
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                <span className="status-pulse"></span>
                <span className="small fw-semibold text-white">
                  YOLOv8 Wildlife Neural Engine Online
                </span>
              </div>

              <h1 className="display-4 fw-bold text-white mb-3 tracking-tight">
                Automated Wildlife <br className="d-none d-md-inline" />
                <span className="gradient-text">Detection & Surveillance</span>
              </h1>

              <p className="lead text-secondary mb-4 pe-lg-4" style={{ fontSize: '1.15rem', lineHeight: '1.7' }}>
                An autonomous surveillance dashboard designed for ecological protection.
                Captures high-frame video, leverages deep-learning object classification,
                and transmits real-time animal sighting telemetry from designated sanctuary zones.
              </p>

              <div className="d-flex flex-wrap justify-content-center justify-content-lg-start gap-3 mb-5">
                <Link to="/dashboard" className="btn btn-wildlife-primary px-4 py-3 d-flex align-items-center gap-2">
                  <span>📊 Explore Dashboard</span>
                </Link>
                <Link to="/detections" className="btn btn-wildlife-outline px-4 py-3 d-flex align-items-center gap-2">
                  <span>🐅 View Live Feeds</span>
                </Link>
                <Link to="/login" className="btn btn-dark border border-secondary px-4 py-3 text-secondary">
                  <span>Sign In</span>
                </Link>
              </div>

              <div className="d-flex flex-wrap justify-content-center justify-content-lg-start gap-4 pt-3 border-top border-secondary border-opacity-25">
                <div>
                  <div className="h4 text-white fw-bold mb-0">94.2%</div>
                  <div className="small text-secondary">Average Confidence</div>
                </div>
                <div className="border-end border-secondary border-opacity-25 d-none d-sm-block"></div>
                <div>
                  <div className="h4 text-white fw-bold mb-0">&lt; 120ms</div>
                  <div className="small text-secondary">Inference Latency</div>
                </div>
                <div className="border-end border-secondary border-opacity-25 d-none d-sm-block"></div>
                <div>
                  <div className="h4 text-white fw-bold mb-0">24/7</div>
                  <div className="small text-secondary">Sanctuary Monitoring</div>
                </div>
              </div>
            </div>

            {/* Right Column: Simulated Wildlife Camera HUD */}
            <div className="col-12 col-lg-5">
              <div className="camera-feed-simulation">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="badge bg-danger bg-opacity-75 text-white d-flex align-items-center gap-1 px-2 py-1">
                    <span className="status-pulse" style={{ backgroundColor: '#ffffff' }}></span> REC • CAM-01
                  </span>
                  <span className="badge-zone">
                    📍 {sampleDetection.location}
                  </span>
                </div>

                <div className="my-4 my-md-5">
                  <div className="bounding-box text-center">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="badge-species">
                        🐾 {sampleDetection.species}
                      </span>
                      <span className="badge-confidence-high">
                        {Math.round(sampleDetection.confidence * 100)}% Confidence
                      </span>
                    </div>

                    <div className="py-4">
                      <div style={{ fontSize: '4rem', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>
                        🐅
                      </div>
                      <div className="small text-white fw-semibold mt-2">
                        Target Identified: Panthera tigris
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center small text-secondary border-top border-success border-opacity-25 pt-2">
                      <span>Source: <code>{sampleDetection.image}</code></span>
                      <span>{sampleDetection.timestamp}</span>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center small text-secondary pt-2 border-top border-secondary border-opacity-25">
                  <span>GPS: 27.1751° N, 78.0421° E</span>
                  <span className="text-success fw-semibold">AI Detection Validated</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. System Architecture Section */}
      <section className="py-5" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <div className="container py-3">
          <div className="text-center mb-5">
            <span className="badge-species mb-2">System Architecture</span>
            <h2 className="text-white fw-bold">End-to-End Detection Pipeline</h2>
            <p className="text-secondary mx-auto" style={{ maxWidth: '600px' }}>
              How raw camera imagery is transformed into actionable wildlife insights across our decoupled 4-tier stack.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-12 col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="stat-icon mb-3">🐍</div>
                <div className="badge bg-dark border border-secondary text-secondary mb-2">Tier 1: AI / ML</div>
                <h5 className="text-white fw-bold">Python + YOLO</h5>
                <p className="small text-secondary mb-0">
                  Processes live CCTV camera frames. Bounding boxes, species labels, and statistical confidence scores are calculated.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="stat-icon mb-3">⚡</div>
                <div className="badge bg-dark border border-secondary text-secondary mb-2">Tier 2: Backend</div>
                <h5 className="text-white fw-bold">Node.js + Express</h5>
                <p className="small text-secondary mb-0">
                  Receives inference payloads, validates sighting coordinates, manages JWT user authentication, and exposes REST endpoints.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="stat-icon mb-3">🍃</div>
                <div className="badge bg-dark border border-secondary text-secondary mb-2">Tier 3: Database</div>
                <h5 className="text-white fw-bold">MongoDB Database</h5>
                <p className="small text-secondary mb-0">
                  Stores historical telemetry, timestamps, zone locations, confidence ratings, and animal sighting archives securely.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="stat-icon mb-3">⚛️</div>
                <div className="badge bg-dark border border-secondary text-secondary mb-2">Tier 4: Frontend</div>
                <h5 className="text-white fw-bold">React Dashboard</h5>
                <p className="small text-secondary mb-0">
                  Delivers real-time surveillance feeds, species distribution charts, confidence alerts, and zone-based search filters.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Capabilities Section */}
      <section className="py-5">
        <div className="container py-3">
          <div className="text-center mb-5">
            <span className="badge-species mb-2">Capabilities</span>
            <h2 className="text-white fw-bold">Built for Forest Sanctuaries & Researchers</h2>
            <p className="text-secondary mx-auto" style={{ maxWidth: '600px' }}>
              Engineered with modern tools to assist wildlife rangers and research ecologists.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-12 col-md-4">
              <div className="wildlife-card h-100">
                <div className="h3 mb-3">🎯</div>
                <h5 className="text-white fw-bold">Species Classification</h5>
                <p className="text-secondary small mb-0">
                  Instantly differentiates tigers, elephants, deer, leopards, and other sanctuary species with high confidence thresholds.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="wildlife-card h-100">
                <div className="h3 mb-3">📍</div>
                <h5 className="text-white fw-bold">Zone-Based Geofencing</h5>
                <p className="text-secondary small mb-0">
                  Organizes surveillance by designated forest quadrants (Zone A, Zone B, Water Reservoirs) to identify animal movement corridors.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="wildlife-card h-100">
                <div className="h3 mb-3">🛡️</div>
                <h5 className="text-white fw-bold">Automated Alert Dispatch</h5>
                <p className="text-secondary small mb-0">
                  Flags low-confidence anomalies and high-priority predator movements to prevent human-wildlife conflict and poaching.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Call to Action Banner */}
      <section className="py-5 mb-4">
        <div className="container">
          <div className="wildlife-card p-4 p-md-5 text-center" style={{
            background: 'linear-gradient(135deg, #13221c 0%, #1e352c 100%)',
            borderColor: 'var(--primary)'
          }}>
            <h2 className="text-white fw-bold mb-3">
              Ready to Monitor Sanctuary Activity?
            </h2>
            <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '600px' }}>
              Access the live analytics dashboard or register an investigator account to manage sanctuary detection logs.
            </p>
            <div className="d-flex flex-wrap justify-content-center gap-3">
              <Link to="/dashboard" className="btn btn-wildlife-primary px-4 py-3 fw-semibold">
                Launch Monitoring Dashboard
              </Link>
              <Link to="/register" className="btn btn-wildlife-outline px-4 py-3 fw-semibold">
                Register Investigator Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
export default LandingPage;