import React, { useRef, useState } from "react";
import YouTube from "react-youtube";
import "../css/YouTubePlayer.css";

const getYouTubeId = (url) => {
  // Extracts the video ID from a YouTube URL
  const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[1].length === 11 ? match[1] : null;
};

const YouTubePlayer = ({ url }) => {
  const playerRef = useRef(null);
  const [playbackRate, setPlaybackRate] = useState(1);

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

  const videoId = getYouTubeId(url);

  return (
    <div className="ytp-space-container">
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