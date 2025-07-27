import React from "react";
import { useNavigate } from "react-router-dom";
import "../css/SpaceTheme.css";
import "../css/Profile.css";

export default function Profile({ user }) {
  const navigate = useNavigate();

  if (!user) return null;

  const handleViewSearchHistory = () => {
    navigate('/search-history');
  };

  return (
    <div className="profile-container">
      {/* Avatar */}
      <div className="profile-avatar">
        🎸
      </div>

      {/* User Info */}
      <div className="profile-info">
        <div className="profile-label" style={{ color: 'var(--primary)' }}>Email Address:</div>
        <div className="profile-email" style={{ color: 'var(--primary)' }}>{user.email}</div>
      </div>

      {/* Account Status */}
      <div className="profile-status">
        <span>✅</span>
        <span className="profile-status-text">Account Verified</span>
      </div>

      {/* Actions */}
      <div className="profile-actions">
        <button 
          onClick={handleViewSearchHistory}
          className="space-button profile-history-btn"
        >
          View Search History
        </button>
      </div>
    </div>
  );
} 