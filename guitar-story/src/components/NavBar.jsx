import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

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
    <nav style={{
      background: "rgba(255, 255, 255, 0.05)",
      backdropFilter: "blur(10px)",
      padding: "1rem 2rem",
      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
      position: "sticky",
      top: 0,
      zIndex: 1000
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: "1200px",
        margin: "0 auto"
      }}>
        <Link to="/" style={{
          textDecoration: "none",
          color: "#90caf9",
          fontSize: "1.5rem",
          fontWeight: "700",
          fontFamily: "'Orbitron', 'Montserrat', 'Arial', sans-serif"
        }}>
          Code Chords
        </Link>
        
        <div style={{
          display: "flex",
          gap: "2rem",
          alignItems: "center"
        }}>
          <Link to="/" style={{
            textDecoration: "none",
            color: "#fff",
            fontWeight: "500",
            transition: "color 0.3s ease"
          }}>
            Home
          </Link>
          <Link to="/practice" style={{
            textDecoration: "none",
            color: "#fff",
            fontWeight: "500",
            transition: "color 0.3s ease"
          }}>
            Practice
          </Link>
          <Link to="/playalong" style={{
            textDecoration: "none",
            color: "#fff",
            fontWeight: "500",
            transition: "color 0.3s ease"
          }}>
            Play Along
          </Link>
          <Link to="/scoreboard" style={{
            textDecoration: "none",
            color: "#fff",
            fontWeight: "500",
            transition: "color 0.3s ease"
          }}>
            Scoreboard
          </Link>
          <Link to="/debug" style={{
            textDecoration: "none",
            color: "#ff6b6b",
            fontWeight: "500",
            transition: "color 0.3s ease"
          }}>
            Debug
          </Link>
          {user ? (
            <button onClick={handleLogout} style={{
              background: "none",
              border: "none",
              color: "#e53935",
              cursor: "pointer",
              fontWeight: "500",
              transition: "color 0.3s ease"
            }}>
              Logout
            </button>
          ) : (
            <Link to="/login" style={{
              textDecoration: "none",
              color: "#90caf9",
              fontWeight: "500",
              transition: "color 0.3s ease"
            }}>
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default NavBar;