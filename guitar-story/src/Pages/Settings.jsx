import React from "react";
import { useTheme } from "../contexts/ThemeContext";
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
    <div className="settings-page">
      <header className="page-head">
        <h1>Settings</h1>
        <p>Your account and how Guitar Story looks on this device.</p>
      </header>

      <div className="settings-pane space-card">
        {/* Account */}
        <section className="settings-row" aria-labelledby="settings-account">
          <div className="settings-label">
            <h2 id="settings-account">Account</h2>
            <p>The account your scores and history are saved to.</p>
          </div>
          <div className="settings-control">
            {currentUser ? (
              <Profile user={currentUser} />
            ) : (
              <p className="settings-note">
                You are not signed in. Use the sign in button at the top of the page to save your progress.
              </p>
            )}
          </div>
        </section>

        {/* Appearance */}
        <section className="settings-row" aria-labelledby="settings-theme">
          <div className="settings-label">
            <h2 id="settings-theme">Appearance</h2>
            <p>Night is easier on the eyes in a dim room. Dawn suits daylight.</p>
          </div>
          <div className="settings-control">
            <div className="segmented" role="group" aria-label="Theme">
              <button
                type="button"
                className={`segmented-option${isDarkMode ? " is-selected" : ""}`}
                aria-pressed={isDarkMode}
                onClick={() => { if (!isDarkMode) toggleTheme(); }}
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 12.2A6.5 6.5 0 0 1 7.8 4a6.5 6.5 0 1 0 8.2 8.2Z" />
                </svg>
                Night
              </button>
              <button
                type="button"
                className={`segmented-option${!isDarkMode ? " is-selected" : ""}`}
                aria-pressed={!isDarkMode}
                onClick={() => { if (isDarkMode) toggleTheme(); }}
              >
                <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <circle cx="10" cy="10" r="3.4" />
                  <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
                </svg>
                Dawn
              </button>
            </div>
          </div>
        </section>

        {/* Session */}
        {currentUser && (
          <section className="settings-row" aria-labelledby="settings-session">
            <div className="settings-label">
              <h2 id="settings-session">Sign out</h2>
              <p>Sign out on this device. Your scores stay saved to your account.</p>
            </div>
            <div className="settings-control">
              <button type="button" onClick={handleSignOut} className="btn-ghost">
                Sign out
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default Settings;
