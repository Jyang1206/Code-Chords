import React from "react";
import { useNavigate } from "react-router-dom";
import "../css/Profile.css";

export default function Profile({ user }) {
  const navigate = useNavigate();

  if (!user) return null;

  const handleViewSearchHistory = () => {
    navigate('/search-history');
  };

  const initial = (user.displayName || user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="profile-container">
      <div className="profile-avatar" aria-hidden="true">
        {initial}
      </div>

      <div className="profile-info">
        {user.displayName && <div className="profile-name">{user.displayName}</div>}
        <div className="profile-email">{user.email}</div>
        <div className="profile-status">
          <span className="profile-status-dot" aria-hidden="true" />
          <span className="profile-status-text">
            {user.emailVerified ? "Email verified" : "Signed in"}
          </span>
        </div>
      </div>

      <div className="profile-actions">
        <button
          type="button"
          onClick={handleViewSearchHistory}
          className="btn-ghost profile-history-btn"
        >
          View search history
        </button>
      </div>
    </div>
  );
}
