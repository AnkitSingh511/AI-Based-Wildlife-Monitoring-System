
/* ==========================================================================
   1. NAVBAR COMPONENT
   ========================================================================== */


import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleNavbar = () => setIsOpen(!isOpen);
  const closeNavbar = () => setIsOpen(false);

  return (
    <nav className="navbar navbar-expand-lg sticky-top py-3" style={{
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div className="container">
        {/* Brand Logo & Title */}
        <Link to="/" className="navbar-brand d-flex align-items-center gap-2" onClick={closeNavbar}>
          <span style={{ fontSize: '1.5rem' }}>🐾</span>
          <span className="fw-bold text-white tracking-tight" style={{ fontSize: '1.2rem' }}>
            Wildlife<span style={{ color: 'var(--primary)' }}>Guard</span>
          </span>
          <span className="d-none d-md-inline-block badge-species ms-2 py-1 px-2" style={{ fontSize: '0.72rem' }}>
            <span className="status-pulse me-1"></span> AI Monitored
          </span>
        </Link>

        {/* Mobile Hamburger Toggle Button */}
        <button
          className="navbar-toggler border-0 text-white"
          type="button"
          onClick={toggleNavbar}
          aria-expanded={isOpen}
          aria-label="Toggle navigation"
          style={{ boxShadow: 'none' }}
        >
          <span style={{ fontSize: '1.4rem' }}>{isOpen ? '✕' : '☰'}</span>
        </button>

        {/* Collapsible Nav Items */}
        <div className={`collapse navbar-collapse ${isOpen ? 'show' : ''}`} id="wildlifeNavbar">
          <ul className="navbar-nav mx-auto mb-2 mb-lg-0 gap-lg-3">
            <li className="nav-item">
              <NavLink
                to="/"
                end
                onClick={closeNavbar}
                className={({ isActive }) =>
                  `nav-link px-3 py-2 rounded ${isActive ? 'text-white fw-semibold bg-dark' : 'text-secondary'}`
                }
                style={({ isActive }) => ({
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent'
                })}
              >
                Home
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/dashboard"
                onClick={closeNavbar}
                className={({ isActive }) =>
                  `nav-link px-3 py-2 rounded ${isActive ? 'text-white fw-semibold bg-dark' : 'text-secondary'}`
                }
                style={({ isActive }) => ({
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent'
                })}
              >
                Dashboard
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                to="/detections"
                onClick={closeNavbar}
                className={({ isActive }) =>
                  `nav-link px-3 py-2 rounded ${isActive ? 'text-white fw-semibold bg-dark' : 'text-secondary'}`
                }
                style={({ isActive }) => ({
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  border: isActive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent'
                })}
              >
                Detections
              </NavLink>
            </li>
          </ul>

          {/* Right Action Buttons */}
          <div className="d-flex align-items-center gap-2 mt-3 mt-lg-0">
            <Link
              to="/login"
              onClick={closeNavbar}
              className="btn btn-wildlife-outline px-3 py-2"
              style={{ fontSize: '0.9rem' }}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              onClick={closeNavbar}
              className="btn btn-wildlife-primary px-3 py-2"
              style={{ fontSize: '0.9rem' }}
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}



export default Navbar;