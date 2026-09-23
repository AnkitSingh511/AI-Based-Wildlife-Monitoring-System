import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      setSuccess("Account registered successfully! Signing you in...");

      // Automatically sign in the newly registered user
      try {
        await login({
          email: email.trim(),
          password,
        });
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);
      } catch {
        // If auto-login fails, redirect to login page
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      }
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
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
                📝
              </div>
              <h4 className="text-white fw-bold mb-1">Create Account</h4>
              <p className="text-secondary small mb-0">
                Register as a wildlife investigator or sanctuary ranger
              </p>
            </div>

            {error && (
              <div className="wildlife-alert-danger mb-4 d-flex align-items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="wildlife-alert-success mb-4 d-flex align-items-center gap-2">
                <span>✅</span>
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="small text-secondary fw-semibold mb-1 d-block">
                  Full Name
                </label>
                <input
                  type="text"
                  className="wildlife-input"
                  placeholder="Dr. Jane Goodall"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

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

              <div className="mb-3">
                <label className="small text-secondary fw-semibold mb-1 d-block">
                  Password
                </label>
                <input
                  type="password"
                  className="wildlife-input"
                  placeholder="•••••••• (min 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="small text-secondary fw-semibold mb-1 d-block">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="wildlife-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Register Account</span>
                )}
              </button>
            </form>

            <div className="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
              <p className="text-secondary small mb-0">
                Already have an account?{" "}
                <Link to="/login" className="fw-semibold" style={{ color: "var(--accent)" }}>
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;