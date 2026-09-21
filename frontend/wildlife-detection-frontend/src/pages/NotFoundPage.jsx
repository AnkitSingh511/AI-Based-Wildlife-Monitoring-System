import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <div className="container py-5 text-center">
      <div className="py-5">
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>
          🧭
        </div>

        <h1 className="text-white mb-2">
          404 - Zone Not Found
        </h1>

        <p className="text-secondary mb-4">
          The wildlife sector or page you are looking for does not exist.
        </p>

        <Link to="/" className="btn btn-wildlife-primary px-4 py-2">
          Return Home
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;