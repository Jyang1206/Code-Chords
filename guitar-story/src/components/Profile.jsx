import React from "react";
import { useNavigate } from "react-router-dom";
import "../css/SpaceTheme.css";

export default function Profile({ user }) {
  const navigate = useNavigate();

  if (!user) return null;

  const handleViewSearchHistory = () => {
    navigate('/search-history');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1.5rem',
      padding: '1.5rem',
      border: '1px solid var(--border)',
      borderRadius: '15px',
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 0 15px rgba(255, 179, 71, 0.3)'
    }}>
      {/* Avatar */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2.5rem',
        boxShadow: '0 0 20px var(--glow)'
      }}>
        🚀
      </div>

      {/* User Info */}
      <div style={{
        textAlign: 'center',
        width: '100%'
      }}>
        <div style={{
          color: 'var(--text-secondary)',
          fontSize: '0.9rem',
          marginBottom: '0.5rem',
          fontFamily: 'var(--font-secondary)'
        }}>
          Email Address:
        </div>
        <div style={{
          color: 'var(--text)',
          fontSize: '1.1rem',
          fontWeight: '600',
          fontFamily: 'var(--font-primary)',
          wordBreak: 'break-word'
        }}>
          {user.email}
        </div>
      </div>

      {/* Account Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        background: 'rgba(0, 184, 148, 0.1)',
        border: '1px solid #00b894',
        borderRadius: '20px',
        color: '#00b894'
      }}>
        <span>✅</span>
        <span style={{ fontSize: '0.9rem' }}>Account Verified</span>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%'
      }}>
        <button 
          onClick={handleViewSearchHistory}
          className="space-button"
          style={{
            width: '100%',
            fontSize: '1rem'
          }}
        >
          View Search History
        </button>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'rgba(255, 179, 71, 0.05)'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎯</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Practice Sessions</div>
            <div style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 'bold' }}>0</div>
          </div>
          
          <div style={{
            textAlign: 'center',
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'rgba(74, 144, 226, 0.05)'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🏆</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>High Score</div>
            <div style={{ fontSize: '1.2rem', color: 'var(--secondary)', fontWeight: 'bold' }}>0</div>
          </div>
        </div>
      </div>
    </div>
  );
} 