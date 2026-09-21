function DetectionsPage() {
  return (
    <div className="container py-4">
      <div className="mb-4">
        <h2 className="text-white mb-1">Detection Records</h2>

        <p className="text-secondary mb-0">
          Surveillance records filtered by species, confidence, and location.
        </p>
      </div>

      <div className="wildlife-card text-center py-5">
        <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>
          🐅
        </div>

        <h4 className="text-white">Detection Records Feed</h4>

        <p className="text-secondary mb-0">
          Detection tables, filtering, and detailed cards will be implemented
          in STEP 8 & STEP 9.
        </p>
      </div>
    </div>
  );
}

export default DetectionsPage;