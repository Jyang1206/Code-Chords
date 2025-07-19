import React, { useEffect, useRef } from "react";

// Helper: parse a tab line for fret numbers (MVP: look for digits)
function parseFretNumbers(tabLine) {
  // Example: e|--0--2--3--|
  // Returns array of { stringIdx, fretNum, x } for each note
  // For MVP, just find all digits and their index
  const matches = [];
  if (!tabLine) return matches;
  // For each string (6 lines), look for digits
  const stringNames = ["e", "B", "G", "D", "A", "E"];
  stringNames.forEach((s, i) => {
    const regex = new RegExp(`^${s}[|: -]*([0-9xX-]*)`, "i");
    const lineMatch = tabLine.match(regex);
    if (lineMatch && lineMatch[1]) {
      // Find all digits in the line
      for (let idx = 0; idx < lineMatch[1].length; idx++) {
        const char = lineMatch[1][idx];
        if (/[0-9]/.test(char)) {
          matches.push({ stringIdx: i, fretNum: parseInt(char), x: idx });
        }
      }
    }
  });
  return matches;
}

const FRETBOARD_WIDTH = 640;
const FRETBOARD_HEIGHT = 480;
const NUM_STRINGS = 6;
const NUM_FRETS = 12;

function PlayAlongOverlay({ tabLine }) {
  const videoRef = useRef();
  const canvasRef = useRef();

  useEffect(() => {
    // Start webcam
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
        };
      }
    });
  }, []);

  useEffect(() => {
    // Draw overlay for current tab line
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, FRETBOARD_WIDTH, FRETBOARD_HEIGHT);
    if (!tabLine) return;
    // Parse fret numbers from tab line
    const notes = parseFretNumbers(tabLine);
    // Draw fretboard lines
    for (let s = 0; s < NUM_STRINGS; s++) {
      const y = 60 + s * 60;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(FRETBOARD_WIDTH - 40, y);
      ctx.strokeStyle = "#bbb";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (let f = 0; f <= NUM_FRETS; f++) {
      const x = 40 + f * ((FRETBOARD_WIDTH - 80) / NUM_FRETS);
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, FRETBOARD_HEIGHT - 60);
      ctx.strokeStyle = f === 0 ? "#888" : "#444";
      ctx.lineWidth = f === 0 ? 4 : 2;
      ctx.stroke();
    }
    // Draw notes as colored circles
    notes.forEach(({ stringIdx, fretNum, x }) => {
      const y = 60 + stringIdx * 60;
      const fretX = 40 + fretNum * ((FRETBOARD_WIDTH - 80) / NUM_FRETS);
      ctx.beginPath();
      ctx.arc(fretX, y, 18, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffeb3b";
      ctx.fill();
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = "#222";
      ctx.textAlign = "center";
      ctx.fillText(fretNum, fretX, y + 6);
    });
  }, [tabLine]);

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