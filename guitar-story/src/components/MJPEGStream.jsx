import React, { useState, useEffect, useContext } from "react";
import "../css/MJPEGStream.css";
import { ThemeContext } from "../App";

const BACKEND_URL = "http://localhost:8000";

function MJPEGStream() {
  const { lightMode } = useContext(ThemeContext);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [statusText, setStatusText] = useState("Ready to start streaming");
  const [currentScale, setCurrentScale] = useState({ root: 'C', type: 'major', notes: [] });

  // Start MJPEG stream
  const startStream = async () => {
    try {
      setStatusText("Starting stream...");
      
      // Start the stream on the backend
      const response = await fetch(`${BACKEND_URL}/start_stream`); //seems redundant
      if (!response.ok) {
        throw new Error('Failed to start stream');  
      }
      
      // Set the MJPEG stream URL
      const mjpegUrl = `${BACKEND_URL}/mjpeg_stream`;
      setStreamUrl(mjpegUrl); //set URL, consequently will be used in return statement 
      setIsStreaming(true);
      setStatusText("Streaming active - detecting frets and notes...");
      
    } catch (error) {
      console.error("Error starting stream:", error);
      setStatusText(`Error: ${error.message}`);
    }
  };

  // Stop MJPEG stream
  const stopStream = async () => {
    try {
      setStatusText("Stopping stream...");
      
      // Stop the stream on the backend
      const response = await fetch(`${BACKEND_URL}/stop_stream`);
      if (!response.ok) {
        throw new Error('Failed to stop stream');
      }
      
      setStreamUrl("");
      setIsStreaming(false);
      setStatusText("Stream stopped");
      
    } catch (error) {
      console.error("Error stopping stream:", error);
      setStatusText(`Error: ${error.message}`);
    }
  };

  // Change scale function
  const changeScale = async (root, scaleType) => {
    try {
      const response = await fetch(`${BACKEND_URL}/change_scale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ root, scale_type: scaleType }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentScale({ root, type: scaleType, notes: data.scale?.notes || [] });
        setStatusText(`Scale changed to ${root} ${scaleType}`);
      } else {
        throw new Error('Failed to change scale');
      }
    } catch (error) {
      console.error("Error changing scale:", error);
      setStatusText(`Error changing scale: ${error.message}`);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStreaming) {
        stopStream();
      }
    };
  }, []);

  return (
    <div className={`mjpeg-stream${lightMode ? " light" : " dark"}`}>
      <div className="stream-container">
        <div className="video-container">
          {isStreaming && streamUrl ? (
            <img
              src={streamUrl} //returns stream video
              alt="Guitar fret detection stream"
              className="stream-video"
              onError={(e) => {
                console.error("Stream error:", e);
                setStatusText("Stream error - check backend connection");
              }}
            />
          ) : (
            <div className="placeholder">
              <div className="placeholder-text">
                {isStreaming ? "Connecting to stream..." : "Click 'Start Stream' to begin"}
              </div>
            </div>
          )}
        </div>
        
        <div className="controls">
          <div className="control-buttons">
            {!isStreaming ? (
              <button 
                className="start-btn"
                onClick={startStream}
                disabled={isStreaming}
              >
                Start Stream
              </button>
            ) : (
              <button 
                className="stop-btn"
                onClick={stopStream}
                disabled={!isStreaming}
              >
                Stop Stream
              </button>
            )}
          </div>
          
          <div className="scale-controls">
            <h3>Scale Controls</h3>
            <div className="scale-buttons">
              <div className="root-notes">
                <label>Root Note:</label>
                {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(note => (
                  <button
                    key={note}
                    className={`scale-btn ${currentScale.root === note ? 'active' : ''}`}
                    onClick={() => changeScale(note, currentScale.type)}
                  >
                    {note}
                  </button>
                ))}
              </div>
              
              <div className="scale-types">
                <label>Scale Type:</label>
                {['major', 'minor', 'pentatonic_major', 'pentatonic_minor', 'blues'].map(type => (
                  <button
                    key={type}
                    className={`scale-btn ${currentScale.type === type ? 'active' : ''}`}
                    onClick={() => changeScale(currentScale.root, type)}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="current-scale">
              <strong>Current Scale:</strong> {currentScale.root} {currentScale.type}
              {currentScale.notes.length > 0 && (
                <div className="scale-notes">
                  Notes: {currentScale.notes.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="status">
          <div className="status-indicator">
            <span className={`status-dot ${isStreaming ? 'active' : 'inactive'}`}></span>
            {statusText}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MJPEGStream; 