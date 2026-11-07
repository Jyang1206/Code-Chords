import React, { useRef, useState, useEffect } from "react";
import YouTube from "react-youtube";
import { useSearchHistory } from "../contexts/SearchHistoryContext";
import { useNavigate, useLocation } from "react-router-dom";
import { extractVideoId } from "../utils/youtubeUtils";
import "../css/SpaceTheme.css";
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
        <h3>Lesson video</h3>
        <button
          type="button"
          className="history-btn btn-ghost"
          onClick={handleViewHistory}
        >
          See past videos
        </button>
      </div>

      <div className="ytp-space-player">
        {videoId ? (
          <YouTube
            videoId={videoId}
            onReady={onReady}
            className="ytp-embed"
            iframeClassName="ytp-embed-frame"
            opts={{
              width: '100%',
              height: '400',
              playerVars: {
                autoplay: 0,
                controls: 1,
                modestbranding: 1,
                rel: 0
              }
            }}
          />
        ) : (
          <div className="ytp-empty">
            That link doesn't look like a YouTube video. Paste a full youtube.com or youtu.be link.
          </div>
        )}
      </div>

      {/* Playback Rate Controls */}
      <div className="ytp-space-slider-container">
        <label className="ytp-space-label" htmlFor="ytp-speed">
          Speed
        </label>
        <div className="ytp-speed-track">
          <input
            id="ytp-speed"
            className="ytp-space-slider"
            type="range"
            min="0.25"
            max="2"
            step="0.25"
            value={playbackRate}
            onChange={handleSliderChange}
            aria-valuetext={`${playbackRate} times speed`}
          />
          <div className="ytp-speed-scale" aria-hidden="true">
            <span>0.25×</span>
            <span>1×</span>
            <span>2×</span>
          </div>
        </div>
        <output className="ytp-space-speed" htmlFor="ytp-speed">
          {playbackRate}×
        </output>
      </div>

      {/* Status Message */}
      {isSaving && (
        <div className="ytp-status" role="status">
          Saving to your history…
        </div>
      )}
    </div>
  );
};

export default YouTubePlayer; 