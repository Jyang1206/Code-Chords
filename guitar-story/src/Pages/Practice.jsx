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
    <div className="practice-page">
      <header className="page-head">
        <h1>Practice</h1>
        <p>Point your camera at the neck, choose a key and scale, and see where the notes sit while you play.</p>
      </header>

      <section className="practice-section practice-section--stage" aria-label="Camera practice">
        <GuitarObjDetection />
      </section>

      <section className="practice-section practice-section--video" aria-labelledby="practice-youtube-title">
        <div className="practice-section-head">
          <h2 className="practice-title" id="practice-youtube-title">
            Slow down a YouTube lesson
          </h2>
          <p className="practice-description">
            Paste a link, then lower the speed to learn a part one phrase at a time.
          </p>
        </div>
        <div className="youtube-input-container">
          <label className="youtube-label" htmlFor="practice-youtube-url">
            YouTube link
          </label>
          <input
            id="practice-youtube-url"
            type="url"
            inputMode="url"
            value={youtubeUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="space-input youtube-input"
          />
        </div>
        {youtubeUrl && <YouTubePlayer url={youtubeUrl} />}
      </section>
    </div>
  );
}

export default Practice; 