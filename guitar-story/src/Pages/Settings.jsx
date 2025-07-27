import React from "react";
import { useTheme } from "../contexts/ThemeContext";
import "../css/SpaceTheme.css";
import "../css/Settings.css";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import Profile from "../components/Profile";

function Settings() {
  const { isDarkMode, toggleTheme } = useTheme();
  const { currentUser } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  };

  return (
    <div className="settings-container" style={{ 
      minHeight: '100vh', 
      padding: '2rem',
      position: 'relative',
      zIndex: 10
    }}>
      <div className="space-card" style={{ 
        maxWidth: '800px', 
        margin: '0 auto',
        textAlign: 'center',
        background: 'rgba(26, 26, 46, 0.8)',
        backdropFilter: 'blur(10px)',
        border: '2px solid var(--glow)',
        boxShadow: '0 0 20px var(--glow), inset 0 0 20px rgba(255, 179, 71, 0.1)'
      }}>
        <h1 className="glow-text" style={{
          fontFamily: 'var(--font-primary)',
          fontSize: '2.5rem',
          marginBottom: '2rem',
          color: 'var(--primary)'
        }}>
          Mission Control
        </h1>

        {/* Profile Section */}
        <div className="profile-section space-card" style={{
          marginBottom: '2rem',
          textAlign: 'left',
          background: 'rgba(26, 26, 46, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border)',
          boxShadow: '0 0 15px rgba(255, 179, 71, 0.3)'
        }}>
          <h2 style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: 'var(--secondary)'
          }}>
            User Profile
          </h2>
          <Profile user={currentUser} />
        </div>

        {/* Theme Settings */}
        <div className="theme-section space-card" style={{
          marginBottom: '2rem',
          textAlign: 'center',
          background: 'rgba(26, 26, 46, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border)',
          boxShadow: '0 0 15px rgba(255, 179, 71, 0.3)'
        }}>
          <h2 style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: 'var(--accent)'
          }}>
            Theme Settings
          </h2>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Current Theme:
            </span>
            <span style={{ 
              color: 'var(--primary)',
              fontWeight: 'bold',
              fontSize: '1.1rem'
            }}>
              {isDarkMode ? 'Dark Mode (Space)' : 'Light Mode (Nebula)'}
            </span>
          </div>

          <button 
            onClick={toggleTheme} 
            className="space-button"
            style={{
              fontSize: '1.1rem',
              padding: '12px 24px',
              marginBottom: '1rem'
            }}
          >
            {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            lineHeight: '1.5'
          }}>
            {isDarkMode 
              ? 'Experience the vastness of space with our dark theme featuring stars, meteors, and cosmic elements.'
              : 'Explore the beauty of nebulas with our light theme featuring soft gradients and celestial colors.'
            }
          </p>
        </div>

        {/* Account Actions */}
        <div className="account-section space-card" style={{
          marginBottom: '2rem',
          textAlign: 'center',
          background: 'rgba(26, 26, 46, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border)',
          boxShadow: '0 0 15px rgba(255, 179, 71, 0.3)'
        }}>
          <h2 style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: '#ff6b6b'
          }}>
            Account Actions
          </h2>

          <button 
            onClick={handleSignOut} 
            className="space-button"
            style={{
              background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
              fontSize: '1.1rem',
              padding: '12px 24px'
            }}
          >
            Sign Out
          </button>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            marginTop: '1rem'
          }}>
            Sign out of your account and return to the login screen.
          </p>
        </div>

        {/* App Information */}
        <div className="info-section space-card" style={{
          textAlign: 'center',
          background: 'rgba(26, 26, 46, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border)',
          boxShadow: '0 0 15px rgba(255, 179, 71, 0.3)'
        }}>
          <h2 style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: 'var(--primary)'
          }}>
            About Code Chords
          </h2>

          <p style={{
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            marginBottom: '1rem'
          }}>
            Code Chords is your all-in-one guitar learning platform that combines AI technology 
            with traditional learning methods to create the ultimate musical experience.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '2rem'
          }}>
            <div style={{
              padding: '1rem',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'rgba(255, 179, 71, 0.05)'
            }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>🎸</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                AI-Powered Practice
              </p>
            </div>
            <div style={{
              padding: '1rem',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'rgba(74, 144, 226, 0.05)'
            }}>
              <h3 style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>🎵</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Play Along Mode
              </p>
            </div>
            <div style={{
              padding: '1rem',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'rgba(155, 89, 182, 0.05)'
            }}>
              <h3 style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>📊</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Progress Tracking
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings; 