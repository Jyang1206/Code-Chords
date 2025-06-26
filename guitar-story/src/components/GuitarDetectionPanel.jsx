import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8000"; // Change if your Flask backend runs elsewhere

const ROOTS = ["C", "A", "G", "E", "F", "D"];
const SCALES = [
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "pentatonic_minor", label: "Pentatonic Minor" },
  { value: "blues", label: "Blues" },
  { value: "dorian", label: "Dorian" },
  { value: "mixolydian", label: "Mixolydian" }
];

function GuitarDetectionPanel() {
  const [health, setHealth] = useState("Checking...");
  const [fretData, setFretData] = useState([]);
  const [root, setRoot] = useState("C");
  const [scaleType, setScaleType] = useState("major");
  const [confidence, setConfidence] = useState(50);
  const [status, setStatus] = useState("Initializing...");
  const [cameraFailed, setCameraFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // Health check
  useEffect(() => {
    axios.get(`${API_BASE}/health`)
      .then(() => setHealth("Healthy"))
      .catch(() => setHealth("Backend not reachable"));
  }, []);

  // Poll fret data
  useEffect(() => {
    const interval = setInterval(() => {
      axios.get(`${API_BASE}/get_frets`)
        .then(res => setFretData(res.data.frets || []))
        .catch(() => setFretData([]));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Camera/video feed error handling
  useEffect(() => {
    let timer = setTimeout(() => {
      if (!videoLoaded) {
        setCameraFailed(true);
        setStatus("Camera failed to initialize");
        setLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [videoLoaded]);

  // Handlers
  const handleScaleChange = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/change_scale`, {
        root,
        scale_type: scaleType
      });
      setStatus(`Changed scale to ${root} ${scaleType}`);
    } catch {
      setStatus("Failed to change scale");
    }
  };

  const handleConfidenceChange = async (e) => {
    const value = Number(e.target.value);
    setConfidence(value);
    try {
      await axios.post(`${API_BASE}/update_confidence`, { threshold: value / 100 });
      setStatus(`Confidence threshold set to ${value}%`);
    } catch {
      setStatus("Failed to update confidence threshold");
    }
  };

  return (
    <div className="guitar-detection-panel">
      <h2>Guitar Detection System</h2>
      <div>Status: {status}</div>
      <div>Backend Health: {health}</div>
      <div style={{ margin: "1em 0" }}>
        {loading && !cameraFailed && (
          <div>Initializing camera and detection system...</div>
        )}
        {cameraFailed && (
          <div style={{ color: "red" }}>
            Camera failed to initialize, please enable camera access in your browser settings and try again.
          </div>
        )}
        <img
          ref={videoRef}
          src={`${API_BASE}/video_feed`}
          alt="Video Feed"
          style={{ width: 480, height: 360, display: cameraFailed ? "none" : "block" }}
          onLoad={() => { setVideoLoaded(true); setLoading(false); setStatus("Camera initialized"); }}
          onError={() => { setCameraFailed(true); setLoading(false); setStatus("Camera failed to initialize"); }}
        />
      </div>
      <form onSubmit={handleScaleChange} style={{ marginBottom: "1em" }}>
        <label>
          Root:
          <select value={root} onChange={e => setRoot(e.target.value)}>
            {ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label>
          Scale:
          <select value={scaleType} onChange={e => setScaleType(e.target.value)}>
            {SCALES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <button type="submit">Change Scale</button>
      </form>
      <div>
        <label>
          Confidence Threshold: {confidence}%
          <input
            type="range"
            min="0"
            max="100"
            value={confidence}
            onChange={handleConfidenceChange}
          />
        </label>
      </div>
      <div style={{ marginTop: "1em" }}>
        <h4>Fret Data</h4>
        <pre style={{ maxHeight: 200, overflow: "auto", background: "#f0f0f0", padding: 10 }}>
          {JSON.stringify(fretData, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default GuitarDetectionPanel; 