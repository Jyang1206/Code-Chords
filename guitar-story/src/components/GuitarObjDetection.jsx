import { InferenceEngine, CVImage } from "inferencejs";
import { useEffect, useRef, useState, useMemo } from "react";
import "../css/GuitarObjDetection.css";
import AudioPitchDetector from "./AudioPitchDetector";

// --- Fretboard Logic ---
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']; // 6th to 1st string
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

function getScaleNotes(root, scaleName) {
  const rootIdx = ALL_NOTES.indexOf(root);
  const intervals = SCALES[scaleName];
  return intervals.map((interval) => ALL_NOTES[(rootIdx + interval) % 12]);
}

function getNoteAtPosition(stringIdx, fretNum) {
  const openNoteIdx = ALL_NOTES.indexOf(OPEN_STRINGS[stringIdx]);
  const noteIdx = (openNoteIdx + fretNum) % 12;
  return ALL_NOTES[noteIdx];
}

function getStringNotePositions(stringIdx, scaleNotes, numFrets = 12) {
  const openNoteIdx = ALL_NOTES.indexOf(OPEN_STRINGS[stringIdx]);
  let positions = [];
  for (let fret = 0; fret <= numFrets; fret++) {
    const noteIdx = (openNoteIdx + fret) % 12;
    if (scaleNotes.includes(ALL_NOTES[noteIdx])) {
      positions.push(fret);
    }
  }
  return positions;
}
// --- End Fretboard Logic ---

function GuitarObjDetection() {
  const inferEngine = useMemo(() => {
    return new InferenceEngine();
  }, []);
  const [modelWorkerId, setModelWorkerId] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);

  const videoRef = useRef();
  const canvasRef = useRef();

  // --- Scale/Key Controls State ---
  const ROOT_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SCALE_TYPES = ['major', 'minor', 'pentatonic_major', 'pentatonic_minor', 'blues'];
  const [selectedRoot, setSelectedRoot] = useState('C');
  const [selectedScale, setSelectedScale] = useState('major');
  const scaleNotes = useMemo(() => getScaleNotes(selectedRoot, selectedScale), [selectedRoot, selectedScale]);

  // --- Fix: Use refs to always access latest state in async callbacks ---
  const selectedRootRef = useRef(selectedRoot);
  const selectedScaleRef = useRef(selectedScale);
  const scaleNotesRef = useRef(scaleNotes);
  useEffect(() => { selectedRootRef.current = selectedRoot; }, [selectedRoot]);
  useEffect(() => { selectedScaleRef.current = selectedScale; }, [selectedScale]);
  useEffect(() => { scaleNotesRef.current = scaleNotes; }, [scaleNotes]);
  // --- End fix ---

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
    if (modelWorkerId) {
      startWebcam();
    }
  }, [modelWorkerId]);

  // Ensure latest scaleNotes and selectedRoot/selectedScale are used in detectFrame
  useEffect(() => {
    // Redraw overlay when scale changes
    if (canvasRef.current && videoRef.current && modelWorkerId) {
      // Force a redraw by calling detectFrame once
      detectFrame(true);
    }
    // eslint-disable-next-line
  }, [selectedRoot, selectedScale]);

  const startWebcam = () => {
    var constraints = {
      audio: false,
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "environment",
      },
    };

    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = function () {
        videoRef.current.width = videoRef.current.videoWidth;
        videoRef.current.height = videoRef.current.videoHeight;
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        videoRef.current.play();
      };

      videoRef.current.onplay = () => {
        var ctx = canvasRef.current.getContext("2d");
        var height = videoRef.current.videoHeight;
        var width = videoRef.current.videoWidth;
        videoRef.current.width = width;
        videoRef.current.height = height;
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        detectFrame();
      };
    });
  };

  // Pass forceRedraw=true to only draw overlay (no new inference)
  const detectFrame = (forceRedraw = false) => {
    if (!modelWorkerId) setTimeout(() => detectFrame(forceRedraw), 100 / 3);

    if (forceRedraw) {
      // Just redraw overlay using last predictions if available
      if (window._lastPredictions) {
        drawOverlay(window._lastPredictions);
      }
      return;
    }

    const img = new CVImage(videoRef.current);
    inferEngine.infer(modelWorkerId, img).then((predictions) => {
      window._lastPredictions = predictions;
      drawOverlay(predictions);
      setTimeout(detectFrame, 100 / 3);
    });
  };

  // Draw overlay using latest scaleNotes and selectedRoot
  const drawOverlay = (predictions) => {
    var ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Filter out hand detections
    const filteredPredictions = predictions.filter(pred => pred.class !== 'Hand');

    // --- Heuristic Rotation Correction ---
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
    // --- End Heuristic Rotation Correction ---

    // --- Dynamic Scaling for Distance ---
    // Use average bbox height as proxy for distance
    let avgFretHeight = 60; // default
    if (filteredPredictions.length > 0) {
      avgFretHeight = filteredPredictions.reduce((sum, pred) => sum + pred.bbox.height, 0) / filteredPredictions.length;
    }
    // Clamp scaling factor
    const minFretHeight = 30, maxFretHeight = 120;
    const scaleFactor = Math.max(0.5, Math.min(1.5, avgFretHeight / 60));
    // Dots and font sizes
    const rootRadius = 6 * scaleFactor;
    const scaleRadius = 5 * scaleFactor;
    const nonScaleRadius = 2.5 * scaleFactor;
    const fontSize = 9 * scaleFactor;
    // --- End Dynamic Scaling ---

    // Use refs for latest values
    const currentRoot = selectedRootRef.current;
    const currentScale = selectedScaleRef.current;
    const currentScaleNotes = scaleNotesRef.current;

    // Draw scale notes with rotation correction
    for (var i = 0; i < filteredPredictions.length; i++) {
      var prediction = filteredPredictions[i];
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
        let yString = yCenter - height / 2 + (stringIdx * height) / 5;
        let xFret = xCenter;
        let dx = 0;
        let dy = yString - yCenter;
        let xRot = xCenter + dx * Math.cos(angle) - dy * Math.sin(angle);
        let yRot = yCenter + dx * Math.sin(angle) + dy * Math.cos(angle);

        let noteName = getNoteAtPosition(stringIdx, fretNum);
        let isRoot = noteName === currentRoot;
        let isInScale = currentScaleNotes.includes(noteName);
        if (isRoot) {
          ctx.beginPath();
          ctx.arc(xRot, yRot, rootRadius, 0, 2 * Math.PI);
          ctx.fillStyle = 'red';
          ctx.fill();
          ctx.closePath();
        } else if (isInScale) {
          ctx.beginPath();
          ctx.arc(xRot, yRot, scaleRadius, 0, 2 * Math.PI);
          ctx.fillStyle = 'blue';
          ctx.fill();
          ctx.closePath();
        } else {
          ctx.beginPath();
          ctx.arc(xRot, yRot, nonScaleRadius, 0, 2 * Math.PI);
          ctx.fillStyle = 'grey';
          ctx.fill();
          ctx.closePath();
        }
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = 'white';
        ctx.fillText(noteName, xRot + 7 * scaleFactor, yRot + 3 * scaleFactor);
      }
    }
  };

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
          Guitar Object Detection
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
              position: "relative",
              background: "rgba(0, 0, 0, 0.3)",
              borderRadius: "15px",
              overflow: "hidden",
              minHeight: "400px"
            }}>
              <video
                id="video"
                ref={videoRef}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block"
                }}
                playsInline
                muted
              />
              <canvas
                id="canvas"
                ref={canvasRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none"
                }}
              />
              {/* Scale label overlay */}
              <div style={{
                position: "absolute",
                top: "1rem",
                left: "1rem",
                background: "rgba(0, 0, 0, 0.7)",
                color: "#90caf9",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: "600"
              }}>
                {selectedRootRef.current} {selectedScaleRef.current.replace('_', ' ')}
              </div>
              
              {/* Audio note display using AudioPitchDetector */}
              <AudioPitchDetector>
                {({ note, frequency, listening, start, stop, error }) => {
                  // Extract note name (strip octave)
                  const noteName = note ? note.replace(/\d+$/, "") : null;
                  // Check if note is in scale
                  const currentScaleNotes = scaleNotesRef.current;
                  const isInScale = noteName && currentScaleNotes.includes(noteName);

                  // --- Keep last detected note/frequency for 2 seconds ---
                  const [displayNote, setDisplayNote] = useState(null);
                  const [displayFreq, setDisplayFreq] = useState(null);
                  const [displayTimeout, setDisplayTimeout] = useState(null);
                  // Update displayNote/freq on new detection
                  useEffect(() => {
                    if (note && frequency) {
                      setDisplayNote(note);
                      setDisplayFreq(frequency);
                      if (displayTimeout) clearTimeout(displayTimeout);
                      // If not in scale, display for 4s, else 2s
                      const timeoutMs = (!isInScale && noteName) ? 4000 : 2000;
                      const timeout = setTimeout(() => {
                        setDisplayNote(null);
                        setDisplayFreq(null);
                      }, timeoutMs);
                      setDisplayTimeout(timeout);
                    } else if (!note && !frequency && displayTimeout == null && (displayNote || displayFreq)) {
                      // If no note, start a timeout to clear after 2s (in case missed above)
                      const timeout = setTimeout(() => {
                        setDisplayNote(null);
                        setDisplayFreq(null);
                      }, 2000);
                      setDisplayTimeout(timeout);
                    }
                    // Cleanup on unmount or note change
                    return () => {
                      if (displayTimeout) clearTimeout(displayTimeout);
                    };
                  }, [note, frequency, isInScale, noteName]);
                  // --- End keep last note logic ---

                  return (
                    <div style={{
                      position: "absolute",
                      top: "1rem",
                      right: "1rem",
                      background: "rgba(255, 255, 255, 0.1)",
                      backdropFilter: "blur(10px)",
                      borderRadius: "12px",
                      padding: "1rem",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      minWidth: "200px"
                    }}>
                      <div style={{ fontSize: "0.9rem", color: "#90caf9", marginBottom: "0.5rem" }}>
                        🎤 Detected Note
                      </div>
                      <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#fff", marginBottom: "0.25rem" }}>
                        {displayNote || '--'}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#b0bec5", marginBottom: "0.5rem" }}>
                        {displayFreq ? displayFreq.toFixed(2) + ' Hz' : '--'}
                      </div>
                      {!isInScale && noteName && (
                        <div style={{ fontSize: "0.8rem", color: "#ff6b6b", marginBottom: "0.5rem" }}>
                          Note {noteName} is not in the {selectedRootRef.current} {selectedScaleRef.current.replace('_',' ')} scale!
                        </div>
                      )}
                      {error && <div style={{ fontSize: "0.8rem", color: "#ff6b6b", marginBottom: "0.5rem" }}>{error}</div>}
                      <div style={{ textAlign: "center" }}>
                        {!listening ? (
                          <button 
                            style={{
                              fontSize: "0.9rem",
                              padding: "0.5rem 1rem",
                              borderRadius: "8px",
                              border: "none",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                              background: "linear-gradient(45deg, #1976d2, #7e57c2)",
                              color: "#fff",
                              boxShadow: "0 2px 8px rgba(25, 118, 210, 0.3)"
                            }}
                            onClick={start}
                          >
                            Start Audio
                          </button>
                        ) : (
                          <button 
                            style={{
                              fontSize: "0.9rem",
                              padding: "0.5rem 1rem",
                              borderRadius: "8px",
                              border: "none",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                              background: "linear-gradient(45deg, #e53935, #c62828)",
                              color: "#fff",
                              boxShadow: "0 2px 8px rgba(229, 57, 53, 0.3)"
                            }}
                            onClick={stop}
                          >
                            Stop Audio
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }}
              </AudioPitchDetector>
            </div>
            
            {/* Scale Controls */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem"
            }}>
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
                    {ROOT_NOTES.map(note => (
                      <button
                        key={note}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "8px",
                          border: "1px solid rgba(144, 202, 249, 0.3)",
                          background: selectedRoot === note 
                            ? "rgba(144, 202, 249, 0.2)" 
                            : "rgba(255, 255, 255, 0.1)",
                          color: "#fff",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          fontSize: "0.9rem"
                        }}
                        onClick={() => setSelectedRoot(note)}
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
                    {SCALE_TYPES.map(type => (
                      <button
                        key={type}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "8px",
                          border: "1px solid rgba(144, 202, 249, 0.3)",
                          background: selectedScale === type 
                            ? "rgba(144, 202, 249, 0.2)" 
                            : "rgba(255, 255, 255, 0.1)",
                          color: "#fff",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          fontSize: "0.9rem",
                          textAlign: "left"
                        }}
                        onClick={() => setSelectedScale(type)}
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
                  <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>
                    Notes: {scaleNotes.join(', ')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuitarObjDetection;
