import React, { useEffect } from "react";
import "../css/Settings.css";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import Profile from "../components/Profile";

function Settings() {
  const { user } = useAuth();

  useEffect(() => {
    document.body.classList.add("settings-page");
    return () => {
      document.body.classList.remove("settings-page");
    };
  }, []);

  return (
    <div style={{
      background: "linear-gradient(135deg, #0c0e1a 0%, #1a1b2e 50%, #2d1b69 100%)",
      color: "#fff",
      fontFamily: "'Orbitron', 'Montserrat', 'Arial', sans-serif",
      minHeight: "100vh",
      padding: "2rem"
    }}>
      <div style={{
        maxWidth: "800px",
        margin: "0 auto"
      }}>
        <h1 style={{
          textAlign: "center",
          fontSize: "2.5rem",
          fontWeight: "700",
          background: "linear-gradient(45deg, #90caf9, #7e57c2)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "2rem"
        }}>
          Settings
        </h1>
        
        <div style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(10px)",
          borderRadius: "20px",
          padding: "2rem",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
        }}>
          <Profile user={user} />
          
          <button 
            style={{
              fontSize: "1.1rem",
              padding: "0.8rem 2rem",
              borderRadius: "50px",
              border: "none",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.3s ease",
              background: "linear-gradient(45deg, #e53935, #c62828)",
              color: "#fff",
              boxShadow: "0 4px 15px rgba(229, 57, 53, 0.4)",
              margin: "1.5rem 0",
              width: "100%"
            }} 
            onClick={() => signOut(auth)}
          >
        Sign Out
      </button>
          
          <div style={{
            marginTop: "2rem",
            padding: "1.5rem",
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.1)"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1rem"
            }}>
              <label style={{ fontSize: "1.1rem", color: "#90caf9", fontWeight: "600" }}>
                Theme Mode
              </label>
              <div style={{
                position: "relative",
                width: "60px",
                height: "30px",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "15px",
                cursor: "pointer",
                border: "1px solid rgba(255, 255, 255, 0.2)"
              }}>
                <div style={{
                  position: "absolute",
                  top: "2px",
                  left: "2px",
                  width: "26px",
                  height: "26px",
                  background: "linear-gradient(45deg, #90caf9, #7e57c2)",
                  borderRadius: "50%",
                  transition: "transform 0.3s ease",
                  transform: "translateX(0px)"
                }}></div>
              </div>
            </div>
            <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>
              Space theme is always enabled for the best experience!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings; 