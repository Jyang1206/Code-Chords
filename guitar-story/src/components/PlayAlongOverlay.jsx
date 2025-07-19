import React, { useEffect, useRef, useMemo, useState } from "react";
import { InferenceEngine, CVImage } from "inferencejs";

const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']; // 6th to 1st string
const FRETBOARD_WIDTH = 640;
const FRETBOARD_HEIGHT = 480;
const NUM_STRINGS = 6;

function getNoteAtPosition(stringIdx, fretNum) {
  const openNoteIdx = ALL_NOTES.indexOf(OPEN_STRINGS[stringIdx]);
  const noteIdx = (openNoteIdx + fretNum) % 12;
  return ALL_NOTES[noteIdx];
}

function PlayAlongOverlay({ arpeggioNote }) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const inferEngine = useMemo(() => new InferenceEngine(), []);
  const [modelWorkerId, setModelWorkerId] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [lastFrets, setLastFrets] = useState([]);

  // Start model worker
  useEffect(() => {
    if (!modelLoading) {
      setModelLoading(true);
      inferEngine
        .startWorker(
          "guitar-fretboard-tn3dc",
          2,
          "rf_WjCqW7ti3EQQzaSufa5ZNPoCu522"
        )
        .then((id) => setModelWorkerId(id));
    }
  }, [inferEngine, modelLoading]);

  // Start webcam
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
        };
      }
    });
  }, []);

  // Inference loop
  useEffect(() => {
    if (!modelWorkerId) return;
    let running = true;
    const detectFrame = () => {
      if (!running) return;
      const img = new CVImage(videoRef.current);
      inferEngine.infer(modelWorkerId, img).then((predictions) => {
        // Only keep fret detections
        const fretPreds = predictions.filter(pred => pred.class && pred.class.startsWith('Zone'));
        setLastFrets(fretPreds);
        drawOverlay(fretPreds);
        setTimeout(detectFrame, 1000 / 6); // ~6 FPS
      });
    };
    detectFrame();
    return () => { running = false; };
    // eslint-disable-next-line
  }, [modelWorkerId, arpeggioNote]);

  // Draw overlay for current arpeggio note
  function drawOverlay(fretPreds) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, FRETBOARD_WIDTH, FRETBOARD_HEIGHT);
    if (!arpeggioNote) return;
    if (!fretPreds || fretPreds.length === 0) {
      console.log("No detected frets for overlay.");
      return;
    }
    // Find the detected fret for the current arpeggio note's fretNum
    const fretNum = arpeggioNote.fretNum;
    const stringIdx = arpeggioNote.stringIdx;
    const note = arpeggioNote.note;
    const isRoot = arpeggioNote.isRoot;
    // Find the detection with class Zone{fretNum}
    const fretDet = fretPreds.find(pred => pred.class === `Zone${fretNum}`);
    if (!fretDet) {
      console.log(`No detected fret for Zone${fretNum}`);
      return;
    }
    // Calculate string positions within the detected fret bbox
    const { x, y, width, height } = fretDet.bbox;
    // For each string, y = y - height/2 + (stringIdx * height/5)
    const yString = y - height / 2 + (stringIdx * height) / 5;
    const xFret = x;
    // Draw dot and label (match GuitarObjDetection aesthetics)
    ctx.beginPath();
    ctx.arc(xFret, yString, isRoot ? 16 : 12, 0, 2 * Math.PI);
    ctx.fillStyle = isRoot ? "#e53935" : "#1976d2"; // red for root, blue for others
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = isRoot ? "bold 20px Arial" : "bold 16px Arial";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(note, xFret, yString + 6);
    // Debug log
    console.log(`Overlaying note ${note} (string ${stringIdx + 1}, fret ${fretNum}) at (${xFret},${yString}) using detected Zone${fretNum}`);
    // Optionally, draw detected fret bbox for debugging
    ctx.save();
    ctx.strokeStyle = "#00e676";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(x - width / 2, y - height / 2, width, height);
    ctx.restore();
    // Optionally, label the fret number
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "#00e676";
    ctx.fillText(`Fret ${fretNum}`, xFret, y - height / 2 - 10);
    // Debug: log all detected frets
    fretPreds.forEach(pred => {
      console.log(`Detected: ${pred.class} at (${pred.bbox.x},${pred.bbox.y})`);
    });
  }

  return (
    <div style={{ position: "relative", width: FRETBOARD_WIDTH, height: FRETBOARD_HEIGHT, margin: "0 auto" }}>
      <video
        ref={videoRef}
        width={FRETBOARD_WIDTH}
        height={FRETBOARD_HEIGHT}
        autoPlay
        muted
        style={{ position: "absolute", left: 0, top: 0, zIndex: 1, background: "#000" }}
      />
      <canvas
        ref={canvasRef}
        width={FRETBOARD_WIDTH}
        height={FRETBOARD_HEIGHT}
        style={{ position: "absolute", left: 0, top: 0, zIndex: 2, pointerEvents: "none" }}
      />
    </div>
  );
}

export default PlayAlongOverlay; 