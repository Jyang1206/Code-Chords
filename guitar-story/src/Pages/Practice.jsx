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
  const [cameraPermission, setCameraPermission] = useState(null); // null, 'granted', 'denied'
  // Replace with your actual video feed URL
  const videoFeedUrl = "http://localhost:5001/video_feed";

  useEffect(() => {
    document.body.classList.add("practice-page");
    return () => document.body.classList.remove("practice-page");
  }, []);

  useEffect(() => {
    // Prompt the user for camera access on mount
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => setCameraPermission('granted'))
        .catch(() => setCameraPermission('denied'));
    } else {
      setCameraPermission('unsupported');
    }
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
        {cameraPermission === null && (
          <div className="camera-permission-message">
            <p>Requesting access to your camera for real-time guitar detection...</p>
          </div>
        )}
        {cameraPermission === 'granted' && <GuitarDetectionPanel />}
        {cameraPermission === 'denied' && (
          <div className="camera-permission-message error">
            <p>Camera access was denied. Please enable camera access in your browser settings and reload the page.</p>
          </div>
        )}
        {cameraPermission === 'unsupported' && (
          <div className="camera-permission-message error">
            <p>Your browser does not support camera access.</p>
          </div>
        )}
      </div>
    </>
  );
}

export default Practice; 