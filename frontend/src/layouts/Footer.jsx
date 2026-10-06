function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "var(--bg-surface)",
        borderTop: "1px solid var(--border-color)",
        padding: "2rem 0 1.5rem 0",
        marginTop: "auto",
      }}
    >
      <div className="container">
        <div className="row align-items-center gy-3">
          <div className="col-12 col-md-6 text-center text-md-start">
            <div className="d-flex align-items-center justify-content-center justify-content-md-start gap-2 mb-1">
              <span>🐾</span>
              <span className="fw-semibold text-white">Wildlife Detection System</span>
            </div>
            <p className="small text-secondary mb-0">
              Autonomous Real-Time Wildlife Monitoring & Alert Platform
            </p>
          </div>

          <div className="col-12 col-md-6 text-center text-md-end">
            <div className="d-inline-flex flex-wrap justify-content-center justify-content-md-end gap-2 text-secondary small">
              <span className="badge bg-dark border border-secondary text-secondary">
                Smart Wildlife Detection
              </span>
              <span className="badge bg-dark border border-secondary text-secondary">
                Real-Time Surveillance
              </span>
              <span className="badge bg-dark border border-secondary text-secondary">
                Ecological Conservation
              </span>
            </div>
          </div>
        </div>

        <hr style={{ borderColor: "var(--border-color)", margin: "1.5rem 0 1rem 0" }} />

        <div className="text-center text-secondary small">
          © {new Date().getFullYear()} Wildlife Detection System. Dedicated to Wildlife Preservation and Ecological Research.
        </div>
      </div>
    </footer>
  );
}

export default Footer;