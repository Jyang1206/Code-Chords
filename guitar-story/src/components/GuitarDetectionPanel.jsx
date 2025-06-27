import React, { useRef, useEffect, useState, useContext } from "react";
import "../css/GuitarDetectionPanel.css";
import { ThemeContext } from "../App";

const API_KEY = "PXAqQENZCRpDPtJ8rd4w";
const MODEL_ID = "guitar-frets-segmenter";
const MODEL_VERSION = "1";

function GuitarDetectionPanel() {
  const { lightMode } = useContext(ThemeContext);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const detectionInterval = useRef(null);

  const [enableCameraText, setEnableCameraText] = useState("Show Camera");
  const [disableCameraText, setDisableCameraText] = useState("Hide Camera");
  const [statusText, setStatusText] = useState("Waiting for guitar...");
  const [cameraActive, setCameraActive] = useState(false);

  const videoWidth = 640;
  const videoHeight = 480;

  // Load Roboflow model
  const loadModel = async () => {
    setStatusText("Loading model...");
    await window.Roboflow
      .auth({ apiKey: API_KEY })
      .load({
        model: MODEL_ID,
        version: MODEL_VERSION,
        onMetaData: function (m) {},
      })
      .then((ml) => {
        modelRef.current = ml;
        setStatusText("Model loaded. Ready!");
      });
  };

  // Enable camera and start detection
  const showWebCam = async () => {
    setStatusText("Requesting camera...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: videoWidth, height: videoHeight, facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setEnableCameraText("Camera On");
        setStatusText("Camera active. Loading model...");
        await loadModel();
        startDetection();
      }
    } catch (err) {
      setStatusText("Camera access denied");
    }
  };

  // Stop camera and detection
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
      setEnableCameraText("Show Camera");
      setStatusText("Camera stopped");
    }
    stopDetection();
  };

  // Start detection loop
  const startDetection = () => {
    if (modelRef.current && videoRef.current) {
      detectionInterval.current = setInterval(() => {
        detect();
      }, 1000); // 1 FPS
      setStatusText("Detection running...");
    }
  };

  // Stop detection loop
  const stopDetection = () => {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 500);
  };

  // Detection logic
  const detect = async () => {
    if (
      modelRef.current &&
      videoRef.current &&
      videoRef.current.readyState === 4 &&
      canvasRef.current
    ) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
      const detections = await modelRef.current.detect(canvasRef.current);

      ctx.lineWidth = 2;
      detections.forEach((detection) => {
        if (detection.class === "fret" && detection.confidence > 0.5) {
          ctx.strokeStyle = "red";
          ctx.strokeRect(
            detection.bbox.x,
            detection.bbox.y,
            detection.bbox.width,
            detection.bbox.height
          );
        }
      });

      if (detections.length > 0) {
        setStatusText(`Detected ${detections.length} fret(s)`);
      } else {
        setStatusText("No frets detected");
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line
  }, []);

  return (
    <div className={`guitar-detection-panel${lightMode ? " light" : " dark"}`}>
      <div className="video-container" style={{ position: "relative" }}>
        <video
          ref={videoRef}
          width={videoWidth}
          height={videoHeight}
          autoPlay
          muted
          style={{ display: cameraActive ? "block" : "none" }}
        />
        <canvas
          ref={canvasRef}
          width={videoWidth}
          height={videoHeight}
          className="video-canvas"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            display: cameraActive ? "block" : "none",
          }}
        />
      </div>
      <div className="controls">
        <button onClick={showWebCam}>{enableCameraText}</button>
        <button onClick={stopCamera}>{disableCameraText}</button>
        <p className="status-text">{statusText}</p>
      </div>
    </div>
  );
}

export default GuitarDetectionPanel;