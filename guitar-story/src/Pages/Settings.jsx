import React, { useContext, useEffect } from "react";
import { ThemeContext } from "../App";
import "../css/Settings.css";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import Profile from "../components/Profile";

function Settings() {
  const { lightMode, setLightMode } = useContext(ThemeContext);
  const { currentUser } = useAuth();

  useEffect(() => {
    document.body.classList.add("settings-page");
    return () => {
      document.body.classList.remove("settings-page");
    };
  }, []);

  // Debug logging
  console.log('Current light mode state:', lightMode);
  console.log('Theme context available:', !!useContext(ThemeContext));

  const handleThemeToggle = () => {
    console.log('Toggling theme from:', lightMode, 'to:', !lightMode);
    setLightMode((prev) => !prev);
  };

  return (
    <div className="settings-content">
      <h1>Settings</h1>
      <Profile user={currentUser} />
      <button className="cosmic-login-btn" style={{ margin: '1.5rem 0' }} onClick={() => signOut(auth)}>
        Sign Out
      </button>
      <div className="toggle-switch">
        <label htmlFor="mode-toggle">Light Mode</label>
        <input
          id="mode-toggle"
          type="checkbox"
          checked={lightMode}
          onChange={handleThemeToggle}
        />
      </div>
      <p style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.7 }}>
        Current theme: {lightMode ? 'Light' : 'Dark'}
      </p>
    </div>
  );
}

export default Settings; 