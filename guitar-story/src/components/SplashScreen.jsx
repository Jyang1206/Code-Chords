import React, { useEffect, useState } from "react";
import SpaceBackground from "./SpaceBackground";
import "../css/SplashScreen.css";

const SplashScreen = ({ onComplete, duration = 2600 }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setLeaving(true);
      setTimeout(() => onComplete && onComplete(), 380);
    };
    const timer = setTimeout(finish, duration);
    window.addEventListener("mousedown", finish);
    window.addEventListener("keydown", finish);
    window.addEventListener("touchstart", finish, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", finish);
      window.removeEventListener("keydown", finish);
      window.removeEventListener("touchstart", finish);
    };
  }, [duration, onComplete]);

  return (
    <div className={`splash${leaving ? " is-leaving" : ""}`} role="presentation">
      <SpaceBackground />
      <div className="splash-inner">
        <h1 className="splash-word">Guitar Story</h1>
        <div className="splash-strings" aria-hidden="true">
          {["E", "A", "D", "G", "B", "e"].map((n, i) => (
            <div className="splash-string" key={n} style={{ "--i": i }}>
              <span className="splash-note">{n}</span>
              <span className="splash-wire" />
            </div>
          ))}
        </div>
        <p className="splash-hint">Click or press any key to skip</p>
      </div>
    </div>
  );
};

export default SplashScreen;
