import React, { useEffect, useRef, useState } from "react";

function GuitarDetectionPanel() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("Initializing...");
  const [detections, setDetections] = useState([]);
  // const [processedImage, setProcessedImage] = useState(null); // If you want to display processed image

  // Initialize webcam
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStatus("Camera initialized");
      })
      .catch(() => setStatus("Camera failed"));
  }, []);

  // Send frames to backend
  useEffect(() => {
    let intervalId;
    const sendFrame = async () => {
      if (
        videoRef.current &&
        videoRef.current.readyState === 4 &&
        canvasRef.current
      ) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.drawImage(videoRef.current, 0, 0, 480, 360);
        const imageData = canvasRef.current.toDataURL("image/jpeg");
        try {
          const response = await fetch("http://localhost:8000/video_feed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: imageData }),
          });
          const result = await response.json();
          setDetections(result.detections || []);
          // setProcessedImage(result.processed_image); // If you want to display processed image
        } catch (err) {
          setStatus("Backend error");
        }
      }
    };
    intervalId = setInterval(sendFrame, 500); // Send every 500ms
    return () => clearInterval(intervalId);
  }, []);

  // Draw detections
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, 480, 360);
    detections.forEach((det) => {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(det.x, det.y, det.width, det.height);
      ctx.font = "16px Arial";
      ctx.fillStyle = "red";
      ctx.fillText(det.label, det.x, det.y - 5);
    });
  }, [detections]);

  return (
    <div>
      <h2>Guitar Detection System</h2>
      <div>Status: {status}</div>
      <video
        ref={videoRef}
        width={480}
        height={360}
        style={{ display: "none" }}
        playsInline
        muted
      />
      <canvas ref={canvasRef} width={480} height={360} />
      {/* If you want to display processed image from backend:
      {processedImage && <img src={processedImage} alt="Processed" />}
      */}
      <div>
        <h4>Detections</h4>
        <pre>{JSON.stringify(detections, null, 2)}</pre>
      </div>
    </div>
  );
}

export default GuitarDetectionPanel; 