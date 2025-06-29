import React, { useRef, useEffect, useState, useContext } from "react";
import { io } from "socket.io-client";
import "../css/GuitarDetectionPanel.css";
import { ThemeContext } from "../App";

const BACKEND_URL = "http://localhost:8000";

function GuitarDetectionPanel() {
  const { lightMode } = useContext(ThemeContext);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const detectionInterval = useRef(null);

  const [enableCameraText, setEnableCameraText] = useState("Show Camera");
  const [disableCameraText, setDisableCameraText] = useState("Hide Camera");
  const [statusText, setStatusText] = useState("Waiting for guitar...");
  const [cameraActive, setCameraActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentScale, setCurrentScale] = useState({ root: 'C', type: 'major', notes: [] });

  const videoWidth = 640;
  const videoHeight = 480;

  // Initialize WebSocket connection
  useEffect(() => {
    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      console.log('Connected to backend');
      setIsConnected(true);
      setStatusText("Connected to backend");
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from backend');
      setIsConnected(false);
      setStatusText("Disconnected from backend");
    });

    socketRef.current.on('frame_processed', (data) => {
      if (data.error) {
        console.error('Frame processing error:', data.error);
        setStatusText(`Error: ${data.error}`);
      } else if (data.processed_image) {
        // Display the processed frame
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, videoWidth, videoHeight);
          }
        };
        img.src = data.processed_image;
        setStatusText("Processing frames...");
      }
    });

    socketRef.current.on('scale_changed', (data) => {
      if (data.error) {
        console.error('Scale change error:', data.error);
      } else if (data.scale) {
        setCurrentScale(data.scale);
        setStatusText(`Scale changed to ${data.scale.root} ${data.scale.type}`);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

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
        setStatusText("Camera active. Starting detection...");
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          startDetection();
        };
      }
    } catch (err) {
      console.error("Camera access error:", err);
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
    if (videoRef.current && socketRef.current && isConnected) {
      detectionInterval.current = setInterval(() => {
        captureAndSendFrame();
      }, 100); // 10 FPS for smooth processing
      setStatusText("Detection running...");
    }
  };

  // Stop detection loop
  const stopDetection = () => {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
    // Clear canvas
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 500);
  };

  // Capture frame and send to backend
  const captureAndSendFrame = () => {
    if (videoRef.current && videoRef.current.readyState === 4 && socketRef.current && isConnected) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
        
        // Convert canvas to base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Send frame to backend via WebSocket
        socketRef.current.emit('process_frame_ws', { image: imageData });
      }
    }
  };

  // Change scale function
  const changeScale = (root, scaleType) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('change_scale_ws', { root, scale_type: scaleType });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
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
        <button onClick={showWebCam} disabled={!isConnected}>
          {enableCameraText}
        </button>
        <button onClick={stopCamera} disabled={!cameraActive}>
          {disableCameraText}
        </button>
        
        <div className="scale-controls">
          <h4>Scale Controls:</h4>
          <div className="scale-buttons">
            <button onClick={() => changeScale('C', 'major')}>C Major</button>
            <button onClick={() => changeScale('A', 'minor')}>A Minor</button>
            <button onClick={() => changeScale('G', 'major')}>G Major</button>
            <button onClick={() => changeScale('E', 'minor')}>E Minor</button>
            <button onClick={() => changeScale('F', 'major')}>F Major</button>
            <button onClick={() => changeScale('D', 'major')}>D Major</button>
          </div>
        </div>
        
        <div className="scale-info">
          <p>Current Scale: {currentScale.root} {currentScale.type}</p>
          <p>Notes: {currentScale.notes.join(', ')}</p>
        </div>
        
        <p className="status-text">{statusText}</p>
        <p className="connection-status">
          Backend: {isConnected ? "Connected" : "Disconnected"}
        </p>
      </div>
    </div>
  );
}

export default GuitarDetectionPanel;