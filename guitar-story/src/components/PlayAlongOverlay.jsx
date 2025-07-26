import React, { useEffect, useRef, useMemo } from "react";
import { InferenceEngine, CVImage } from "inferencejs";
import AudioPitchDetector from "../utils/AudioPitchDetector";

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

function PlayAlongOverlay({ 
  arpeggioNotes = [], 
  currentStep = 0, 
  highlightedNotes = [],
  onCorrectNote,
  onIncorrectNote
}) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const inferEngine = useMemo(() => new InferenceEngine(), []);
  const [modelWorkerId, setModelWorkerId] = React.useState(null);
  const [modelLoading, setModelLoading] = React.useState(false);
  const displayedNotesRef = useRef([]); // Store displayed notes for later reference
  const [lastFeedback, setLastFeedback] = React.useState(null); // 'correct' | 'incorrect' | null
  const [expectedNote, setExpectedNote] = React.useState(null);

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

  useEffect(() => {
    if (!modelWorkerId) return;
    let running = true;
    const detectFrame = () => {
      if (!running) return;
      const img = new CVImage(videoRef.current);
      inferEngine.infer(modelWorkerId, img).then((predictions) => {
        drawOverlay(predictions);
        setTimeout(detectFrame, 1000 / 6);
      });
    };
    detectFrame();
    return () => { running = false; };
    // eslint-disable-next-line
  }, [modelWorkerId, arpeggioNotes, currentStep]);

  // Determine the expected note for the current highlighted note
  React.useEffect(() => {
    if (highlightedNotes && highlightedNotes.length > 0) {
      const n = highlightedNotes[0];
      if (n) {
        // Map stringIdx (1-6) to get note name correctly
        const noteName = getNoteAtPosition(6 - n.stringIdx, n.fretNum);
        setExpectedNote(noteName);
      } else {
        setExpectedNote(null);
      }
    } else {
      setExpectedNote(null);
    }
    setLastFeedback(null); // Reset feedback on step change
  }, [highlightedNotes]);

  function drawOverlay(predictions) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, FRETBOARD_WIDTH, FRETBOARD_HEIGHT);
    // Debug logs for props
    console.log('[DEBUG] highlightedNotes:', highlightedNotes);
    console.log('[DEBUG] arpeggioNotes:', arpeggioNotes);
    console.log('[DEBUG] currentStep:', currentStep);
    const filteredPredictions = predictions.filter(pred => pred.class !== 'Hand');
    const fretCenters = filteredPredictions.map(pred => ({
      x: pred.bbox.x,
      y: pred.bbox.y
    }));
    let angle = 0;
    if (fretCenters.length >= 2) {
      const n = fretCenters.length;
      const meanX = fretCenters.reduce((sum, c) => sum + c.x, 0) / n;
      const meanY = fretCenters.reduce((sum, c) => sum + c.y, 0) / n;
      const num = fretCenters.reduce((sum, c) => sum + (c.x - meanX) * (c.y - meanY), 0);
      const den = fretCenters.reduce((sum, c) => sum + (c.x - meanX) ** 2, 0);
      const slope = den !== 0 ? num / den : 0;
      angle = Math.atan(slope);
    }
    // --- Dynamic Scaling for Distance ---
    let avgFretHeight = 60; // default
    if (filteredPredictions.length > 0) {
      avgFretHeight = filteredPredictions.reduce((sum, pred) => sum + pred.bbox.height, 0) / filteredPredictions.length;
    }
    // Make everything smaller
    const scaleFactor = Math.max(0.4, Math.min(1.0, avgFretHeight / 90));
    const rootRadius = 4 * scaleFactor + 4;
    const arpeggioRadius = 8 * scaleFactor + 6;
    const defaultRadius = 5 * scaleFactor + 3;
    const fontSize = 8 * scaleFactor + 7;
    // Encapsulate all displayed notes
    const displayedNotes = [];
    const safeHighlightedNotes = Array.isArray(highlightedNotes) ? highlightedNotes : [];
    const safeArpeggioNotes = Array.isArray(arpeggioNotes) ? arpeggioNotes : [];
    for (let i = 0; i < filteredPredictions.length; i++) {
      const prediction = filteredPredictions[i];
      let fretNum = 0;
      if (prediction.class.startsWith('Zone')) {
        fretNum = parseInt(prediction.class.replace('Zone', ''));
      } else if (prediction.class.startsWith('Fret')) {
        fretNum = parseInt(prediction.class.replace('Fret', ''));
      } else {
        fretNum = i + 1;
      }
      if (isNaN(fretNum)) fretNum = i + 1;
      if (fretNum < 1) continue;
      let xCenter = prediction.bbox.x;
      let yCenter = prediction.bbox.y;
      let width = prediction.bbox.width;
      let height = prediction.bbox.height;
      for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
        // stringIdx=0 is top (6th string, low E), stringIdx=5 is bottom (1st string, high E)
        let yString = yCenter - height / 2 + (stringIdx * height) / 5;
        let xFret = xCenter;
        let dx = 0;
        let dy = yString - yCenter;
        let xRot = xCenter + dx * Math.cos(angle) - dy * Math.sin(angle);
        let yRot = yCenter + dx * Math.sin(angle) + dy * Math.cos(angle);
        let noteName = getNoteAtPosition(stringIdx, fretNum);
        // For arpeggio/highlight matching, use correct string indexing (1-6 from CHORDS)
        const arpeggioStringIdx = 6 - stringIdx; // Convert 0-5 to 1-6 (inverted)
        // Highlight if in highlightedNotes (compare using arpeggioStringIdx)
        let isHighlighted = safeHighlightedNotes.some(n => n && n.fretNum === fretNum && n.stringIdx === arpeggioStringIdx);
        let isArpeggio = false;
        let isRoot = false;
        if (safeArpeggioNotes && safeArpeggioNotes.length > 0 && currentStep < safeArpeggioNotes.length) {
          const step = safeArpeggioNotes[currentStep];
          isArpeggio = step && (step.fretNum === fretNum && step.stringIdx === arpeggioStringIdx);
          isRoot = step && step.isRoot && isArpeggio;
        }
        // For open string, draw just right of Fret 1 (higher x value, estimate by angle)
        let drawX = xRot;
        if (fretNum === 1 && safeArpeggioNotes.some(n => n && n.fretNum === 0 && n.stringIdx === arpeggioStringIdx)) {
          // Find the open string note for this string
          const openStep = safeArpeggioNotes.find(n => n && n.fretNum === 0 && n.stringIdx === arpeggioStringIdx);
          if (openStep) {
            // Draw open string note just right of Fret 1
            // Estimate offset: project along the fretboard's angle
            const offset = width * 0.7;
            drawX = xRot + offset * Math.cos(angle);
            // If this is the open string note, highlight accordingly
            isHighlighted = safeHighlightedNotes.some(n => n && n.fretNum === 0 && n.stringIdx === arpeggioStringIdx);
            isArpeggio = (safeArpeggioNotes[currentStep]?.fretNum === 0 && safeArpeggioNotes[currentStep]?.stringIdx === arpeggioStringIdx);
            isRoot = openStep.isRoot && isArpeggio;
            noteName = getNoteAtPosition(stringIdx, 0);
          }
        }
        // Only debug log for first fret when highlighting during Play
        if (fretNum === 1 && isHighlighted && safeHighlightedNotes.length > 0) {
          console.log(`[DEBUG PLAY HIGHLIGHT] stringIdx=${stringIdx} (arpeggioStringIdx=${arpeggioStringIdx}), fretNum=${fretNum}, noteName=${noteName}, isHighlighted=${isHighlighted}, highlightedNotes=`, safeHighlightedNotes);
        }
        // Store the note for later reference
        displayedNotes.push({
          fretNum: fretNum === 1 && safeArpeggioNotes.some(n => n && n.fretNum === 0 && n.stringIdx === arpeggioStringIdx) ? 0 : fretNum,
          stringIdx,
          noteName,
          x: drawX,
          y: yRot,
          isArpeggio,
          isRoot,
          isHighlighted
        });
        ctx.beginPath();
        ctx.arc(drawX, yRot, isHighlighted ? arpeggioRadius : (isRoot ? rootRadius : defaultRadius), 0, 2 * Math.PI);
        ctx.fillStyle = isHighlighted ? '#FFD600' : (isRoot ? '#e53935' : '#1976d2');
        ctx.globalAlpha = isHighlighted ? 1 : 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = isHighlighted ? 3 : 1.5;
        ctx.stroke();
        ctx.font = isHighlighted ? `bold ${fontSize + 2}px Arial` : (isRoot ? `bold ${fontSize}px Arial` : `bold ${fontSize - 1}px Arial`);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(noteName, drawX, yRot + 4);
      }
    }
    displayedNotesRef.current = displayedNotes;
  }

  return (
    <AudioPitchDetector>
      {({ note, frequency, listening, start, stop, error }) => {
        // Ensure pitch detection is always running while overlay is mounted
        React.useEffect(() => {
          start();
          return () => stop();
        }, []);
        // Only check correctness if a note is highlighted and detected
        React.useEffect(() => {
          if (!expectedNote || !note) {
            setLastFeedback(null);
            return;
          }
          // note is like "E2", "G3" etc. Only compare the note letter (first part)
          const playedNote = note.replace(/\d+$/, "");
          if (playedNote === expectedNote) {
            setLastFeedback("correct");
            onCorrectNote && onCorrectNote();
          } else {
            setLastFeedback("incorrect");
            onIncorrectNote && onIncorrectNote();
          }
        }, [note, expectedNote, onCorrectNote, onIncorrectNote]);
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
            {/* Enhanced Feedback UI */}
            <div style={{
              position: "absolute",
              top: 18,
              right: 24,
              minWidth: 180,
              maxWidth: 240,
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 2px 16px 0 #90caf9cc, 0 0 12px 1px #7e57c2aa",
              padding: "0.7em 1.2em 0.7em 1.2em",
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              border: lastFeedback === "correct" ? "2.5px solid #4caf50" : lastFeedback === "incorrect" ? "2.5px solid #e53935" : "2.5px solid #e3e3e3",
              color: "#222",
              fontFamily: "'Orbitron', 'Montserrat', 'Arial', sans-serif",
              letterSpacing: 0.5,
              transition: "border 0.2s, box-shadow 0.2s"
            }}>
              <div style={{ fontSize: "0.95em", marginBottom: 2, letterSpacing: 1 }}>
                <span style={{ color: "#7e57c2", fontWeight: 700, textShadow: "0 2px 8px #90caf9cc" }}>Play Along</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "1.1em", fontWeight: 500 }}>
                <span>Exp: <span style={{ color: "#1976d2", fontWeight: 700 }}>{expectedNote || "-"}</span></span>
                <span>•</span>
                <span>Det: <span style={{ color: lastFeedback === "correct" ? "#4caf50" : lastFeedback === "incorrect" ? "#e53935" : "#222", fontWeight: 700 }}>{note ? note.replace(/\d+$/, "") : (listening ? "Listening..." : "-")}</span></span>
                <span style={{ fontSize: "1.5em", marginLeft: 8, textShadow: lastFeedback === "correct" ? "0 0 8px #4caf50aa" : lastFeedback === "incorrect" ? "0 0 8px #e53935aa" : "0 0 6px #90caf9cc" }}>
                  {lastFeedback === "correct" ? "✔️" : lastFeedback === "incorrect" ? "✖️" : ""}
                </span>
              </div>
              {error && (
                <div style={{ color: "#e53935", marginTop: 6, fontSize: "0.95em", fontWeight: 600 }}>{error}</div>
              )}
            </div>
          </div>
        );
      }}
    </AudioPitchDetector>
  );
}

export default PlayAlongOverlay; 