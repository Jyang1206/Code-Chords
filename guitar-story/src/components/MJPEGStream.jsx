import React, { useState, useEffect } from "react";
import "../css/MJPEGStream.css";

const BACKEND_URL = "http://localhost:8000";

function MJPEGStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [statusText, setStatusText] = useState("Ready to start streaming");
  const [currentScale, setCurrentScale] = useState({ root: 'C', type: 'major', notes: [] });

  // Start MJPEG stream
  const startStream = async () => {
    try {
      setStatusText("Starting stream...");
      
      // Start the stream on the backend
      const response = await fetch(`${BACKEND_URL}/start_stream`);
      if (!response.ok) {
        throw new Error('Failed to start stream');
      }
      
      // Set the MJPEG stream URL
      const mjpegUrl = `${BACKEND_URL}/mjpeg_stream`;
      setStreamUrl(mjpegUrl);
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
    <div style={{
      background: "linear-gradient(135deg, #0c0e1a 0%, #1a1b2e 50%, #2d1b69 100%)",
      color: "#fff",
      fontFamily: "'Orbitron', 'Montserrat', 'Arial', sans-serif",
      minHeight: "100vh",
      padding: "2rem"
    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto"
      }}>
        <h1 style={{
          textAlign: "center",
          fontSize: "2.5rem",
          fontWeight: "700",
          background: "linear-gradient(45deg, #90caf9, #7e57c2)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "2rem"
        }}>
          MJPEG Stream
        </h1>
        
        <div style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(10px)",
          borderRadius: "20px",
          padding: "2rem",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "2rem"
          }}>
            {/* Video Container */}
            <div style={{
              background: "rgba(0, 0, 0, 0.3)",
              borderRadius: "15px",
              overflow: "hidden",
              minHeight: "400px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              {isStreaming && streamUrl ? (
                <img
                  src={streamUrl}
                  alt="Guitar fret detection stream"
                  style={{
                    width: "100%",
                    height: "auto",
                    maxHeight: "400px",
                    objectFit: "contain"
                  }}
                  onError={(e) => {
                    console.error("Stream error:", e);
                    setStatusText("Stream error - check backend connection");
                  }}
                />
              ) : (
                <div style={{
                  textAlign: "center",
                  color: "#b0bec5"
                }}>
                  <div style={{ fontSize: "1.2rem", marginBottom: "1rem" }}>
                    {isStreaming ? "Connecting to stream..." : "Click 'Start Stream' to begin"}
                  </div>
                </div>
              )}
            </div>
            
            {/* Controls */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem"
            }}>
              {/* Control Buttons */}
              <div style={{
                textAlign: "center"
              }}>
                {!isStreaming ? (
                  <button 
                    style={{
                      fontSize: "1.1rem",
                      padding: "0.8rem 2rem",
                      borderRadius: "50px",
                      border: "none",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      background: "linear-gradient(45deg, #1976d2, #7e57c2)",
                      color: "#fff",
                      boxShadow: "0 4px 15px rgba(25, 118, 210, 0.4)"
                    }}
                    onClick={startStream}
                    disabled={isStreaming}
                  >
                    Start Stream
                  </button>
                ) : (
                  <button 
                    style={{
                      fontSize: "1.1rem",
                      padding: "0.8rem 2rem",
                      borderRadius: "50px",
                      border: "none",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      background: "linear-gradient(45deg, #e53935, #c62828)",
                      color: "#fff",
                      boxShadow: "0 4px 15px rgba(229, 57, 53, 0.4)"
                    }}
                    onClick={stopStream}
                    disabled={!isStreaming}
                  >
                    Stop Stream
                  </button>
                )}
              </div>
              
              {/* Scale Controls */}
              <div style={{
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: "15px",
                padding: "1.5rem",
                border: "1px solid rgba(255, 255, 255, 0.1)"
              }}>
                <h3 style={{
                  fontSize: "1.2rem",
                  fontWeight: "600",
                  color: "#90caf9",
                  margin: "0 0 1rem 0",
                  textAlign: "center"
                }}>
                  Scale Controls
                </h3>
                
                {/* Root Notes */}
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", color: "#b0bec5" }}>
                    Root Note:
                  </label>
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem"
                  }}>
                    {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(note => (
                      <button
                        key={note}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "8px",
                          border: "1px solid rgba(144, 202, 249, 0.3)",
                          background: currentScale.root === note 
                            ? "rgba(144, 202, 249, 0.2)" 
                            : "rgba(255, 255, 255, 0.1)",
                          color: "#fff",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          fontSize: "0.9rem"
                        }}
                        onClick={() => changeScale(note, currentScale.type)}
                      >
                        {note}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Scale Types */}
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", color: "#b0bec5" }}>
                    Scale Type:
                  </label>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem"
                  }}>
                    {['major', 'minor', 'pentatonic_major', 'pentatonic_minor', 'blues'].map(type => (
                      <button
                        key={type}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "8px",
                          border: "1px solid rgba(144, 202, 249, 0.3)",
                          background: currentScale.type === type 
                            ? "rgba(144, 202, 249, 0.2)" 
                            : "rgba(255, 255, 255, 0.1)",
                          color: "#fff",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          fontSize: "0.9rem",
                          textAlign: "left"
                        }}
                        onClick={() => changeScale(currentScale.root, type)}
                      >
                        {type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Current Scale Display */}
                <div style={{
                  background: "rgba(144, 202, 249, 0.1)",
                  borderRadius: "8px",
                  padding: "1rem",
                  border: "1px solid rgba(144, 202, 249, 0.3)"
                }}>
                  <div style={{ fontWeight: "600", color: "#90caf9", marginBottom: "0.5rem" }}>
                    Current Scale: {currentScale.root} {currentScale.type}
                  </div>
                  {currentScale.notes.length > 0 && (
                    <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>
                      Notes: {currentScale.notes.join(', ')}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Status */}
              <div style={{
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                padding: "1rem",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                textAlign: "center"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem"
                }}>
                  <span style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: isStreaming ? "#4caf50" : "#e53935",
                    boxShadow: isStreaming ? "0 0 8px #4caf50" : "none"
                  }}></span>
                  <span style={{ fontSize: "0.9rem", color: "#b0bec5" }}>
                    {statusText}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MJPEGStream; 