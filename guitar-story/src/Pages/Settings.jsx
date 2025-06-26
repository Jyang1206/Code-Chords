import React, { useContext, useEffect } from "react";
import { ThemeContext } from "../App";
import "../css/Settings.css";

function Settings() {
  const { lightMode, setLightMode } = useContext(ThemeContext);

  useEffect(() => {
    document.body.classList.add("settings-page");
    return () => {
      document.body.classList.remove("settings-page");
    };
  }, []);

  return (
    <div className="settings-content">
      <h1>Settings</h1>
      <p>Welcome to the Settings page! More content coming soon.</p>
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