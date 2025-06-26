import React, { useEffect, useState } from "react";
import "../css/Practice.css";
import GuitarDetectionPanel from "../components/GuitarDetectionPanel";

function Practice() {
  const [confidence, setConfidence] = useState(30);
  const [selectedScale, setSelectedScale] = useState("C_major");
  const [learningMode, setLearningMode] = useState("scales");
  const [detectionStatus, setDetectionStatus] = useState("Initializing...");
  const [currentNote, setCurrentNote] = useState("-");
  const [accuracy, setAccuracy] = useState("-");
  const [loading, setLoading] = useState(true);
  const [cameraFailed, setCameraFailed] = useState(false);
  // Replace with your actual video feed URL
  const videoFeedUrl = "http://localhost:5001/video_feed";

  useEffect(() => {
    document.body.classList.add("practice-page");
    return () => document.body.classList.remove("practice-page");
  }, []);

  useEffect(() => {
    // Set a 10 second timeout for camera initialization
    const timer = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setCameraFailed(true);
        setDetectionStatus("Camera failed to initialize");
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <>
      {loading && (
        <div id="loading-overlay" className="loading-overlay">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">Initializing camera and detection system...</div>
          </div>
        </div>
      )}
      <div className="container">
        <header>
          <h1>Guitar Story <span className="icon">🎸</span></h1>
        </header>
        <GuitarDetectionPanel />
      </div>
    </>
  );
}

export default Practice; 