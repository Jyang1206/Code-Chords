import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "../css/Practice.css";
import GuitarObjDetection from "../components/GuitarObjDetection";
import YouTubePlayer from "../components/YouTubePlayer";

function Practice() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const location = useLocation();
   
  // Handle URL passed from search history
  useEffect(() => {
    if (location.state?.youtubeUrl) {
      setYoutubeUrl(location.state.youtubeUrl);
      // Clear the state to prevent re-using it on subsequent renders
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleUrlChange = (newUrl) => {
    setYoutubeUrl(newUrl.replace(/^@/, ""));
  };

  return (
    <div className="practice-container">
      <div className="practice-section">
        <h2>🎸 Guitar Object Detection</h2>
        <p>Practice with real-time guitar detection and feedback</p>
        <GuitarObjDetection />
      </div>
      
      <div className="practice-section">
        <h2>📺 YouTube Practice</h2>
        <p>Practice along with your favorite YouTube videos</p>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <label style={{ color: "#a3bffa", fontWeight: 500, fontSize: "1.1rem", letterSpacing: 1 }}>
            Paste a YouTube link to practice:
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="YouTube URL"
              style={{
                marginLeft: 12,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #232946",
                background: "#181c2b",
                color: "#e0e6f6",
                width: 320,
                maxWidth: "90%",
                fontSize: "1rem",
                boxShadow: "0 0 8px #2d3250"
              }}
            />
          </label>
        </div>
        {youtubeUrl && <YouTubePlayer url={youtubeUrl} />}
      </div>
    </div>
  );
}

export default Practice; 