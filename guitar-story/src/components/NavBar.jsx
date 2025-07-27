import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import "../css/Navbar.css";
import logoImage from "../assets/Code-Chords Logo.png";
import logoImageLight from "../assets/Code-Chords Logo-light.png";

function NavBar({ setShowAuthModal, setShowSignup }) {
  const { currentUser, logout } = useAuth();
  const { toggleTheme, isDarkMode } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  // Helper for protected nav
  const handleProtectedNav = (path) => {
    if (!currentUser) {
      setShowAuthModal(true);
      setShowSignup(false);
    } else {
      navigate(path);
    }
  };

  return (
    <nav className="navbar space-card">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand glow-text" style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <img src={isDarkMode ? logoImageLight : logoImage} alt={"Code Chords Logo"} style={{ height: 50, width: 'auto', display: 'inline-block', verticalAlign: 'middle' }} />
          Guitar Story
        </Link>
        
        <div className="navbar-links">
          <button className="nav-link nav-btn-link" onClick={() => handleProtectedNav("/practice")}>Practice</button>
          <button className="nav-link nav-btn-link" onClick={() => handleProtectedNav("/playalong")}>Play Along</button>
          <button className="nav-link nav-btn-link" onClick={() => handleProtectedNav("/custom-tabs")}>Custom Tabs</button>
          <button className="nav-link nav-btn-link" onClick={() => handleProtectedNav("/tuner")}>Tuner</button>
          <button className="nav-link nav-btn-link" onClick={() => handleProtectedNav("/scoreboard")}>Scoreboard</button>
          {/* Theme Toggle Button */}
          <button 
            onClick={toggleTheme} 
            className="space-button theme-toggle"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button className= "nav-link nav-btn-link" onClick={() => handleProtectedNav("/Settings")}>Settings</button>
          
            
        </div>
      </div>
    </nav>
  );
}

export default NavBar;