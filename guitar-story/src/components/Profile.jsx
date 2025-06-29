import React from "react";
import "../css/Profile.css";

export default function Profile({ user }) {
  if (!user) return null;
  return (
    <div className="cosmic-profile">
      <div className="cosmic-profile-avatar">
        <span role="img" aria-label="avatar" style={{ fontSize: 48 }}>🪐</span>
      </div>
      <div className="cosmic-profile-info">
        <div className="cosmic-profile-label">Email:</div>
        <div className="cosmic-profile-email">{user.email}</div>
      </div>
    </div>
  );
} 