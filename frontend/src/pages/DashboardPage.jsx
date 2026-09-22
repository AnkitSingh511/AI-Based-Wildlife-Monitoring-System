/* ==========================================================================
   5. PLACEHOLDER VIEWS (FOR UPCOMING STEPS)
   ========================================================================== */

function DashboardPage() {
  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="text-white mb-1">Monitoring Dashboard</h2>

          <p className="text-secondary mb-0">
            System metrics and detection surveillance feed overview.
          </p>
        </div>

        <span className="badge-species">
          <span className="status-pulse me-1"></span>
          Live
        </span>
      </div>

      <div className="wildlife-card text-center py-5">
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>
          📊
        </div>

        <h4 className="text-white">Dashboard View</h4>

        <p className="text-secondary mb-0">
          Full telemetry charts, species breakdown, and confidence gauges
          will be implemented in STEP 7.
        </p>
      </div>
    </div>
  );
}

export default DashboardPage;