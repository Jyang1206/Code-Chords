import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import "../css/Navbar.css";
import logoImage from "../assets/Code-Chords Logo.png";
import logoImageLight from "../assets/Code-Chords Logo-light.png";

const LINKS = [
  { path: "/learn", label: "Learn", open: true },
  { path: "/practice", label: "Practice" },
  { path: "/playalong", label: "Play along" },
  { path: "/custom-tabs", label: "Tabs" },
  { path: "/tuner", label: "Tuner" },
  { path: "/scoreboard", label: "Scoreboard" },
];

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

function NavBar({ setShowAuthModal, setShowSignup }) {
  const { currentUser } = useAuth();
  const { toggleTheme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const go = (path, open = false) => {
    if (!currentUser && !open) {
      setShowAuthModal(true);
      setShowSignup(false);
    } else {
      navigate(path);
    }
  };

  const isActive = (path) => pathname.toLowerCase() === path.toLowerCase();

  return (
    <header className={`navbar${open ? " is-open" : ""}`}>
      <nav className="navbar-container" aria-label="Main">
        <Link to="/" className="navbar-brand">
          <img src={isDarkMode ? logoImageLight : logoImage} alt="" className="navbar-logo" />
          <span>Guitar Story</span>
        </Link>

        <button
          className="navbar-menu"
          aria-expanded={open}
          aria-controls="navbar-links"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span className="sr-only">Menu</span>
        </button>

        <div className="navbar-links" id="navbar-links">
          {LINKS.map((l) => (
            <button
              key={l.path}
              className={`nav-link${isActive(l.path) ? " active" : ""}`}
              aria-current={isActive(l.path) ? "page" : undefined}
              onClick={() => go(l.path, l.open)}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="navbar-tools">
          <button
            onClick={toggleTheme}
            className="nav-icon"
            aria-label={isDarkMode ? "Switch to light theme" : "Switch to dark theme"}
            title={isDarkMode ? "Light theme" : "Dark theme"}
          >
            {isDarkMode ? <SunIcon /> : <MoonIcon />}
          </button>
          {currentUser ? (
            <button
              className={`nav-account${isActive("/settings") ? " active" : ""}`}
              onClick={() => go("/Settings")}
            >
              <span className="nav-avatar" aria-hidden="true">
                {(currentUser.displayName || currentUser.email || "?").charAt(0).toUpperCase()}
              </span>
              Settings
            </button>
          ) : (
            <button
              className="nav-signin"
              onClick={() => { setShowAuthModal(true); setShowSignup(false); }}
            >
              Sign in
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

export default NavBar;
