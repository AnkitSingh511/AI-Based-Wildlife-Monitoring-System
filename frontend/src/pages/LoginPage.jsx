import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    try {
      setLoading(true);
      await login({ email: email.trim(), password });
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-md-6 col-lg-5">
          <div className="wildlife-card p-4 p-md-5">
            <div className="text-center mb-4">
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
                🔐
              </div>
              <h4 className="text-white fw-bold mb-1">Sign In</h4>
              <p className="text-secondary small mb-0">
                Access your wildlife sanctuary surveillance account
              </p>
            </div>

            {error && (
              <div className="wildlife-alert-danger mb-4 d-flex align-items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="small text-secondary fw-semibold mb-1 d-block">
                  Email Address
                </label>
                <input
                  type="email"
                  className="wildlife-input"
                  placeholder="ranger@wildlife.gov"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="small text-secondary fw-semibold">
                    Password
                  </label>
                </div>
                <input
                  type="password"
                  className="wildlife-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-wildlife-primary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status"></span>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            <div className="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
              <p className="text-secondary small mb-0">
                Don't have an account?{" "}
                <Link to="/register" className="fw-semibold" style={{ color: "var(--accent)" }}>
                  Create Account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;