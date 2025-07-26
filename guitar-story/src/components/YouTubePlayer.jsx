import React, { useRef, useState, useEffect } from "react";
import YouTube from "react-youtube";
import { useSearchHistory } from "../contexts/SearchHistoryContext";
import { useNavigate, useLocation } from "react-router-dom";
import { extractVideoId } from "../utils/youtubeUtils";
import "../css/YouTubePlayer.css";

const YouTubePlayer = ({ url }) => {
  const playerRef = useRef(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const { addToHistory } = useSearchHistory();
  const navigate = useNavigate();
  const location = useLocation();
  const lastSavedUrlRef = useRef("");
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Save to history only when URL changes and is valid
  useEffect(() => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Skip if URL is empty or invalid
    if (!url || !extractVideoId(url)) {
      return;
    }

    // Skip if this URL was already saved
    if (lastSavedUrlRef.current === url) {
      return;
    }

    // Skip if URL was passed from search history (to avoid duplicate saves)
    if (location.state?.youtubeUrl === url) {
      return;
    }

    // Skip if already saving
    if (isSaving) {
      return;
    }

    // Add a small delay to prevent rapid successive calls
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await addToHistory(url);
        lastSavedUrlRef.current = url;
      } catch (error) {
        console.error('Error saving to history:', error);
      } finally {
        setIsSaving(false);
      }
    }, 100); // 100ms delay

    // Cleanup timeout on unmount or URL change
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [url, addToHistory, location.state, isSaving]);

  const onReady = (event) => {
    playerRef.current = event.target;
    event.target.setPlaybackRate(playbackRate);
  };

  const handleSliderChange = (e) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(rate);
    }
  };

  const handleViewHistory = () => {
    navigate('/search-history');
  };

  const videoId = extractVideoId(url);

  return (
    <div className="ytp-space-container">
      <div className="ytp-space-header">
        <h3>YouTube Practice</h3>
        <button 
          className="history-btn"
          onClick={handleViewHistory}
        >
          📺 View History
        </button>
      </div>
      
      <div className="ytp-space-player">
        {videoId ? (
          <YouTube
            videoId={videoId}
            opts={{
              width: "100%",
              height: "360",
              playerVars: {
                controls: 1,
                rel: 0,
                modestbranding: 1,
                origin: window.location.origin,
              },
            }}
            onReady={onReady}
          />
        ) : (
          <div style={{ color: "#f7c873", padding: 24 }}>Invalid YouTube URL</div>
        )}
      </div>
      <div className="ytp-space-slider-container">
        <label className="ytp-space-label">
          Speed: <span className="ytp-space-speed">{playbackRate}x</span>
        </label>
        <input
          type="range"
          min="0.25"
          max="2"
          step="0.05"
          value={playbackRate}
          onChange={handleSliderChange}
          className="ytp-space-slider"
        />
      </div>
    </div>
  );
};

export default YouTubePlayer; 