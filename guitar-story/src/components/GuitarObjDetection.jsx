import React, { useEffect, useRef, useState, useMemo, useContext } from "react";
import { ThemeContext } from "../App";
import "../css/GuitarObjDetection.css";
import "../css/GuitarCanvas.css";
import AudioPitchDetector from "../utils/AudioPitchDetector";
import GuitarCanvas from "./GuitarCanvas";
import { useStreamingContext } from "../contexts/StreamingContext";

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
  const { lightMode } = useContext(ThemeContext);
  
  // Try to get isStreaming from context, with fallback
  let isStreaming = false;
  try {
    const context = useStreamingContext();
    isStreaming = context.isStreaming;
    console.log('GuitarObjDetection: Successfully got isStreaming from context:', isStreaming);
  } catch (error) {
    console.log('GuitarObjDetection: Failed to get isStreaming from context, using fallback:', error);
    isStreaming = false;
  }
  
  // Debug logging for streaming state
  console.log('GuitarObjDetection: Final isStreaming value:', isStreaming);
  
  // Track isStreaming changes
  useEffect(() => {
    console.log('GuitarObjDetection: isStreaming changed to:', isStreaming);
  }, [isStreaming]);

  // --- Scale/Key Controls State ---
  const ROOT_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SCALE_TYPES = ['major', 'minor', 'pentatonic_major', 'pentatonic_minor', 'blues'];
  const [selectedRoot, setSelectedRoot] = useState('C');
  const [selectedScale, setSelectedScale] = useState('major');
  const scaleNotes = useMemo(() => getScaleNotes(selectedRoot, selectedScale), [selectedRoot, selectedScale]);

  // Add state to control preprocessed view visibility
  const [showPreprocessedView, setShowPreprocessedView] = useState(false);

  // Track component lifecycle and state changes
  useEffect(() => {
    console.log('GuitarObjDetection: Component mounted');
    return () => {
      console.log('GuitarObjDetection: Component unmounted');
    };
  }, []);

  useEffect(() => {
    console.log('GuitarObjDetection: selectedRoot changed to:', selectedRoot);
  }, [selectedRoot]);

  useEffect(() => {
    console.log('GuitarObjDetection: selectedScale changed to:', selectedScale);
  }, [selectedScale]);

  useEffect(() => {
    console.log('GuitarObjDetection: scaleNotes updated:', scaleNotes);
  }, [scaleNotes]);

  // Draw overlay using latest scaleNotes and selectedRoot
  const drawOverlay = (predictions) => {
    console.log('GuitarObjDetection: drawOverlay called with predictions:', predictions);
    console.log('GuitarObjDetection: Current scale state - root:', selectedRoot, 'scale:', selectedScale, 'notes:', scaleNotes);
    
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Filter out hand detections and only show predictions with confidence > 0.8
    const filteredPredictions = predictions.filter(pred => pred.class !== 'Hand' && pred.confidence > 0.8);

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

    // Use current state values directly - these are always up to date
    const currentRoot = selectedRoot;
    const currentScale = selectedScale;
    const currentScaleNotes = scaleNotes;

    console.log('GuitarObjDetection: Drawing with current values - root:', currentRoot, 'scale:', currentScale, 'notes:', currentScaleNotes);

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
        
        // Debug log for first few notes
        if (fretNum <= 3 && stringIdx <= 2) {
          console.log(`GuitarObjDetection: Note ${noteName} at fret ${fretNum}, string ${stringIdx} - isRoot: ${isRoot}, isInScale: ${isInScale}`);
        }
        
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
    <div className={`guitar-obj-detection${lightMode ? ' light' : ' dark'}`}>
      <div className="guitar-obj-detection-content">
        <GuitarCanvas 
          onPredictions={drawOverlay}
          showCalibration={true}
          showPreprocessedView={showPreprocessedView}
          showDebugCanvas={true}
        >
          {/* Overlay scale label on video */}
          <div className="guitar-scale-label-overlay" style={{ position: 'absolute', zIndex: 3 }}>
            {selectedRoot} {selectedScale.replace('_', ' ')}
          </div>
          {/* AudioPitchDetector overlayed in video-container */}
          <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 4 }}>
            <AudioPitchDetector>
              {({ note, frequency, listening, start, stop, error }) => {
                // Extract note name (strip octave)
                const noteName = note ? note.replace(/\d+$/, "") : null;
                // Check if note is in scale
                const currentScaleNotes = scaleNotes;
                const isInScale = noteName && currentScaleNotes.includes(noteName);

                // --- Keep last detected note/frequency for 2 seconds ---
                const [displayNote, setDisplayNote] = useState(null);
                const [displayFreq, setDisplayFreq] = useState(null);
                const [displayTimeout, setDisplayTimeout] = useState(null);
                const [showScaleWarning, setShowScaleWarning] = useState(false);
                
                // Auto-start audio detection when stream is active
                useEffect(() => {
                  console.log('GuitarObjDetection: Audio useEffect triggered, isStreaming:', isStreaming);
                  
                  // Start audio detection when component mounts and stream is active
                  if (isStreaming) {
                    console.log('GuitarObjDetection: Starting audio detection, calling start()');
                    start();
                  } else {
                    console.log('GuitarObjDetection: Audio detection not starting, isStreaming:', isStreaming);
                  }
                  
                  // Cleanup on unmount
                  return () => {
                    console.log('GuitarObjDetection: Cleaning up audio detection, calling stop()');
                    stop();
                  };
                }, [isStreaming]); // Depend on isStreaming to restart when stream starts
                
                // Update displayNote/freq on new detection
                useEffect(() => {
                  if (note && frequency) {
                    setDisplayNote(note);
                    setDisplayFreq(frequency);
                    
                    // Show scale warning if note is not in scale
                    if (noteName && !isInScale) {
                      setShowScaleWarning(true);
                      // Hide warning after 4 seconds
                      setTimeout(() => setShowScaleWarning(false), 4000);
                    } else {
                      setShowScaleWarning(false);
                    }
                    
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
                  <div className="guitar-audio-note-panel">
                    <div className="audio-note-label">🎤 Detected Note</div>
                    <div className="audio-note-value">{displayNote || '--'}</div>
                    <div className="audio-freq-value">{displayFreq ? displayFreq.toFixed(2) + ' Hz' : '--'}</div>
                    {showScaleWarning && noteName && (
                      <div className="audio-warning">
                        ⚠️ Note {noteName} is not in the {selectedRoot} {selectedScale.replace('_',' ')} scale!
                      </div>
                    )}
                    {error && <div className="audio-warning">{error}</div>}
                    <div className="audio-controls">
                      <div className={`audio-status ${listening ? 'listening' : 'stopped'}`}>
                        {listening ? '🎤 Listening...' : '🔇 Audio Off'}
                      </div>
                      {/* Debug info */}
                      <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                        Debug: isStreaming={isStreaming}, listening={listening.toString()}, error={error || 'none'}
                      </div>
                    </div>
                  </div>
                );
              }}
            </AudioPitchDetector>
          </div>
        </GuitarCanvas>

        {/* Scale controls always at the bottom, centered */}
        <div className="guitar-scale-controls">
          <h3>Scale Controls</h3>
          <div className="guitar-scale-btns-row">
            <div className="guitar-root-notes">
              <label>Root Note: </label>
              {ROOT_NOTES.map(note => (
                <button
                  key={note}
                  className={`guitar-scale-btn${selectedRoot === note ? ' active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('GuitarObjDetection: Root note button clicked:', note);
                    console.log('GuitarObjDetection: Current selectedRoot before change:', selectedRoot);
                    setSelectedRoot(note);
                    console.log('GuitarObjDetection: setSelectedRoot called with:', note);
                  }}
                >
                  {note}
                </button>
              ))}
            </div>
            <div className="guitar-scale-types">
              <label>Scale Type: </label>
              {SCALE_TYPES.map(type => (
                <button
                  key={type}
                  className={`guitar-scale-btn${selectedScale === type ? ' active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('GuitarObjDetection: Scale type button clicked:', type);
                    console.log('GuitarObjDetection: Current selectedScale before change:', selectedScale);
                    setSelectedScale(type);
                    console.log('GuitarObjDetection: setSelectedScale called with:', type);
                  }}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="guitar-current-scale">
            <div className="guitar-scale-notes">
              Notes: {scaleNotes.join(', ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuitarObjDetection;
