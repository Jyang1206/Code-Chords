import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "../css/Navbar.css";

function NavBar() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

    return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          Code Chords
        </Link>
        
        <div className="navbar-links">
          <Link to="/" className="nav-link">
            Home
          </Link>
          <Link to="/practice" className="nav-link">
            Practice
          </Link>
          <Link to="/playalong" className="nav-link">
            Play Along
          </Link>
          <Link to="/custom-tabs" className="nav-link">
            Custom Tabs
          </Link>
          <Link to="/tuner" className="nav-link">
            Tuner
          </Link>
          <Link to="/scoreboard" className="nav-link">
            Scoreboard
          </Link>
          <Link to="/debug" className="nav-link debug">
            Debug
          </Link>
          {user ? (
            <button onClick={handleLogout} className="nav-button">
              Logout
            </button>
          ) : (
            <Link to="/Settings" className="nav-link settings">
              Settings
            </Link>
          )}
            </div>
            </div>
        </nav>
    );
}

export default NavBar;