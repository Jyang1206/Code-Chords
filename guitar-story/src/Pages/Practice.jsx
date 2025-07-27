import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "../css/SpaceTheme.css";
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
        <h2 className="practice-title">
          Guitar Object Detection
        </h2>
        <p className="practice-description">
          Practice with real-time guitar detection and feedback
        </p>
        <GuitarObjDetection />
      </div>
      
      <div className="practice-section">
        <h2 className="practice-title">
          YouTube Practice
        </h2>
        <p className="practice-description">
          Practice along with your favorite YouTube videos
        </p>
        <div className="youtube-input-container">
          <label className="youtube-label">
            Paste a YouTube link to practice:
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="YouTube URL"
              className="space-input youtube-input"
            />
          </label>
        </div>
        {youtubeUrl && <YouTubePlayer url={youtubeUrl} />}
      </div>
    </div>
  );
}

export default Practice; 