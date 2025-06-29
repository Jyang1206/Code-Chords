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
          onChange={() => setLightMode((prev) => !prev)}
        />
      </div>
    </div>
  );
}

export default Settings; 