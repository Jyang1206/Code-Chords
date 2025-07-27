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
    <div className="ytp-space-container space-card" style={{
      padding: '2rem',
      margin: '2rem',
      position: 'relative',
      zIndex: 10,
      background: 'rgba(26, 26, 46, 0.8)',
      backdropFilter: 'blur(10px)',
      border: '2px solid var(--glow)',
      boxShadow: '0 0 20px var(--glow), inset 0 0 20px rgba(255, 179, 71, 0.1)'
    }}>
      <div className="ytp-space-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <h3 style={{
          color: 'var(--primary)',
          fontFamily: 'var(--font-primary)',
          fontSize: '1.5rem',
          margin: 0
        }}>
          YouTube Practice
        </h3>
        <button 
          className="history-btn space-button"
          onClick={handleViewHistory}
          style={{
            fontSize: '0.9rem',
            padding: '0.5rem 1rem'
          }}
        >
          View History
        </button>
      </div>
      
      <div className="ytp-space-player" style={{
        marginBottom: '1.5rem'
      }}>
        {videoId ? (
          <YouTube
            videoId={videoId}
            onReady={onReady}
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
            style={{
              borderRadius: '10px',
              overflow: 'hidden',
              border: '2px solid var(--border)'
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface)',
            border: '2px solid var(--border)',
            borderRadius: '10px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-secondary)',
            fontSize: '1.1rem'
          }}>
            Enter a YouTube URL to start practicing
          </div>
        )}
      </div>

      {/* Playback Rate Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
        padding: '1rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '10px',
        border: '1px solid var(--border)'
      }}>
        <label style={{
          color: 'var(--text)',
          fontFamily: 'var(--font-secondary)',
          fontWeight: '600',
          minWidth: '120px'
        }}>
          Playback Speed:
        </label>
        <input
          type="range"
          min="0.25"
          max="2"
          step="0.25"
          value={playbackRate}
          onChange={handleSliderChange}
          style={{
            flex: 1,
            minWidth: '200px',
            accentColor: 'var(--primary)'
          }}
        />
        <span style={{
          color: 'var(--primary)',
          fontFamily: 'var(--font-primary)',
          fontWeight: 'bold',
          minWidth: '60px',
          textAlign: 'center'
        }}>
          {playbackRate}x
        </span>
      </div>

      {/* Status Message */}
      {isSaving && (
        <div style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          background: 'rgba(0, 184, 148, 0.1)',
          border: '1px solid #00b894',
          borderRadius: '8px',
          color: '#00b894',
          fontSize: '0.9rem',
          textAlign: 'center'
        }}>
          Saving to history...
        </div>
      )}
    </div>
  );
};

export default YouTubePlayer; 