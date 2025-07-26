import React from "react";
import { useNavigate } from "react-router-dom";
import "../css/Profile.css";

export default function Profile({ user }) {
  const navigate = useNavigate();

  if (!user) return null;

  const handleViewSearchHistory = () => {
    navigate('/search-history');
  };

  return (
    <div className="cosmic-profile">
      <div className="cosmic-profile-avatar">
        <span role="img" aria-label="avatar" style={{ fontSize: 48 }}>🪐</span>
      </div>
      <div className="cosmic-profile-info">
        <div className="cosmic-profile-label">Email:</div>
        <div className="cosmic-profile-email">{user.email}</div>
      </div>
      <div className="cosmic-profile-actions">
        <button 
          className="search-history-btn"
          onClick={handleViewSearchHistory}
        >
         View Search History
        </button>
      </div>
    </div>
  );
} 