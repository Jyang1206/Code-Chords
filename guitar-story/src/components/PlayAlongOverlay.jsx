import React, { useEffect, useRef, useMemo, useState } from "react";
import AudioPitchDetector from "../utils/AudioPitchDetector";
import "../css/GuitarObjDetection.css";

// Try to import inferencejs, but provide fallback if it fails
let InferenceEngine, CVImage;
try {
  // Try ES6 import first
  import("inferencejs").then(module => {
    InferenceEngine = module.InferenceEngine;
    CVImage = module.CVImage;
    console.log('InferenceJS loaded successfully via ES6 import');
  }).catch(error => {
    console.warn('ES6 import failed, trying require:', error);
    // Fallback to require
    const inferencejs = require("inferencejs");
    InferenceEngine = inferencejs.InferenceEngine;
    CVImage = inferencejs.CVImage;
    console.log('InferenceJS loaded successfully via require');
  });
} catch (error) {
  console.warn('InferenceJS not available, using fallback mode:', error);
  InferenceEngine = class FallbackInferenceEngine {
    constructor() {
      console.log('Using fallback inference engine');
    }
    async startWorker() { 
      console.log('Fallback: startWorker called');
      return 'fallback-worker'; 
    }
    async infer() { 
      console.log('Fallback: infer called, returning empty array');
      return []; 
    }
  };
  CVImage = class FallbackCVImage {
    constructor(videoElement) {
      console.log('Fallback: CVImage created with video element:', videoElement);
    }
  };
}

const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']; // 6th to 1st string
const NUM_STRINGS = 6;

function getNoteAtPosition(stringIdx, fretNum) {
  const openNoteIdx = ALL_NOTES.indexOf(OPEN_STRINGS[stringIdx]);
  const noteIdx = (openNoteIdx + fretNum) % 12;
  return ALL_NOTES[noteIdx];
}

function PlayAlongOverlay({ arpeggioNotes = [], currentStep = 0, highlightedNotes = [], onCorrectNote, onIncorrectNote }) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const inferEngine = useMemo(() => {
    console.log('Creating inference engine...');
    const engine = new InferenceEngine();
    console.log('Inference engine created:', engine);
    return engine;
  }, []);
  const [modelWorkerId, setModelWorkerId] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [expectedNote, setExpectedNote] = useState(null);
  const [lastFeedback, setLastFeedback] = useState(null);
  const displayedNotesRef = useRef([]); // Store displayed notes for later reference
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  // Add frequency filtering state
  const [lastDetectedNote, setLastDetectedNote] = useState(null);
  const [lastNoteTime, setLastNoteTime] = useState(0);
  const [noteDetectionWindow, setNoteDetectionWindow] = useState(500); // ms window for note detection
  const [frequencyThreshold, setFrequencyThreshold] = useState(0.3); // minimum frequency amplitude to consider
  const [consecutiveDetections, setConsecutiveDetections] = useState(0);
  const [requiredConsecutiveDetections, setRequiredConsecutiveDetections] = useState(3); // require 3 consecutive detections
  
  // Add wrong note detection threshold
  const [consecutiveWrongDetections, setConsecutiveWrongDetections] = useState(0);
  const [requiredConsecutiveWrongDetections, setRequiredConsecutiveWrongDetections] = useState(1); // require 1 consecutive wrong detection to reduce false positives

  useEffect(() => {
    if (!modelLoading) {
      setModelLoading(true);
      console.log('Starting inference engine...');
      inferEngine
        .startWorker(
          "guitar-fretboard-tn3dc",
          2,
          "rf_WjCqW7ti3EQQzaSufa5ZNPoCu522"
        )
        .then((id) => {
          console.log('Inference engine started successfully with ID:', id);
          setModelWorkerId(id);
        })
        .catch((error) => {
          console.error('Inference engine failed to load:', error);
          setModelLoading(false);
        });
    }
  }, [inferEngine, modelLoading]);

  useEffect(() => {
    console.log('Setting up video stream...');
    const constraints = {
      audio: false,
      video: {
        width: { ideal: 900 },
        height: { ideal: 540 },
        facingMode: "environment",
      },
    };
    
    console.log('Calling getUserMedia with constraints:', constraints);
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      console.log('✅ Video stream obtained successfully:', stream);
      if (videoRef.current) {
        console.log('Setting video srcObject...');
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = function () {
          console.log('✅ Video metadata loaded, starting play...');
          console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          // Set video dimensions to match container
          videoRef.current.width = 900;
          videoRef.current.height = 540;
          videoRef.current.play().then(() => {
            console.log('✅ Video play() resolved successfully');
            setVideoLoaded(true);
          }).catch((error) => {
            console.error('❌ Video play() failed:', error);
          });
        };

        videoRef.current.onplay = () => {
          console.log('✅ Video started playing');
          setVideoLoaded(true);
          if (canvasRef.current) {
            var ctx = canvasRef.current.getContext("2d");
            var height = videoRef.current.videoHeight;
            var width = videoRef.current.videoWidth;
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, width, height);
            console.log('✅ Canvas initialized with dimensions:', width, 'x', height);
            console.log('✅ Container dimensions: 900 x 540');
          }
        };
        videoRef.current.onerror = (error) => {
          console.error('❌ Video error:', error);
        };
        videoRef.current.onloadeddata = () => {
          console.log('✅ Video data loaded');
        };
      } else {
        console.error('❌ Video ref is null');
      }
    }).catch((error) => {
      console.error('❌ Camera access denied or unavailable:', error);
      // Continue without camera - the component will still work for audio detection
    });
  }, []);

  // Ensure canvas matches video size on window resize
  useEffect(() => {
    function handleResize() {
      if (videoRef.current && canvasRef.current && videoRef.current.videoWidth && videoRef.current.videoHeight) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debug container dimensions
  useEffect(() => {
    const container = document.querySelector('.guitar-video-container');
    if (container) {
      console.log('Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
      console.log('Container style:', window.getComputedStyle(container));
    } else {
      console.log('Container not found');
    }
  }, []);

  useEffect(() => {
    if (!modelWorkerId || !videoLoaded) return;
    let running = true;
    console.log('Starting prediction loop with modelWorkerId:', modelWorkerId, 'videoLoaded:', videoLoaded);
    const detectFrame = () => {
      if (!running) return;
      try {
        const img = new CVImage(videoRef.current);
        console.log('Created CVImage, calling infer...');
        inferEngine.infer(modelWorkerId, img).then((predictions) => {
          console.log('Received predictions:', predictions);
          drawOverlay(predictions);
          setTimeout(detectFrame, 1000 / 6);
        }).catch((error) => {
          console.error('Error during inference:', error);
          setTimeout(detectFrame, 1000 / 6);
        });
      } catch (error) {
        console.error('Error creating CVImage or calling infer:', error);
        setTimeout(detectFrame, 1000 / 6);
      }
    };
    detectFrame();
    return () => { 
      console.log('Stopping prediction loop');
      running = false; 
    };
    // eslint-disable-next-line
  }, [modelWorkerId, videoLoaded]);

  // Determine the expected note for the current highlighted note
  React.useEffect(() => {
    if (highlightedNotes && highlightedNotes.length > 0) {
      const n = highlightedNotes[0];
      if (n) {
        // Map stringIdx (1-6) to get note name correctly
        const noteName = getNoteAtPosition(6 - n.stringIdx, n.fretNum);
        console.log(`[EXPECTED NOTE DEBUG] stringIdx: ${n.stringIdx}, fretNum: ${n.fretNum}, calculated: ${6 - n.stringIdx}, noteName: ${noteName}`);
        setExpectedNote(noteName);
        
        // Reset frequency filtering when expected note changes
        setLastDetectedNote(null);
        setLastNoteTime(0);
        setConsecutiveDetections(0);
        setConsecutiveWrongDetections(0);
        console.log(`[FREQ FILTER] Reset filtering for new expected note: ${noteName}`);
      } else {
        setExpectedNote(null);
      }
    } else {
      setExpectedNote(null);
    }
    setLastFeedback(null); // Reset feedback on step change
  }, [highlightedNotes]);

  function drawOverlay(predictions) {
    console.log('drawOverlay called with predictions:', predictions);
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas ref is null');
      return;
    }
    const ctx = canvas.getContext("2d");
    // Use actual canvas dimensions instead of hardcoded values
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Debug logs for props
    console.log('[DEBUG] highlightedNotes:', highlightedNotes);
    console.log('[DEBUG] arpeggioNotes:', arpeggioNotes);
    console.log('[DEBUG] currentStep:', currentStep);
    const filteredPredictions = predictions.filter(pred => pred.class !== 'Hand');
    console.log('Filtered predictions (excluding Hand):', filteredPredictions);
    const fretCenters = filteredPredictions.map(pred => ({
      x: pred.bbox.x,
      y: pred.bbox.y
    }));
    console.log('Fret centers:', fretCenters);
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
        // For arpeggio/highlight matching, convert from 1-6 (CHORDS) to 0-5 (overlay)
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
    <AudioPitchDetector clarityThreshold={0.92}>
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
          
          const currentTime = Date.now();
          const playedNote = note.replace(/\d+$/, "");
          
          // Frequency filtering logic
          let shouldProcessNote = true;
          
          // 1. Check if this is the same note as last detected (ring-over)
          if (lastDetectedNote === playedNote && 
              currentTime - lastNoteTime < noteDetectionWindow) {
            console.log(`[FREQ FILTER] Ignoring ring-over from previous note: ${playedNote}`);
            shouldProcessNote = false;
          }
          
          // 2. Handle wrong notes with threshold (require consecutive detections)
          if (playedNote !== expectedNote) {
            // Increment consecutive wrong detections
            setConsecutiveWrongDetections(prev => prev + 1);
            console.log(`[FREQ FILTER] Wrong note detected: ${playedNote}, expected: ${expectedNote}, consecutive wrong: ${consecutiveWrongDetections + 1}`);
            
            // Reset consecutive correct detections for wrong notes
            setConsecutiveDetections(0);
            
            // Only process wrong notes if we have enough consecutive wrong detections
            if (shouldProcessNote && consecutiveWrongDetections >= requiredConsecutiveWrongDetections - 1) {
              console.log(`[NOTE DETECTION] INCORRECT! Calling onIncorrectNote`);
              setLastFeedback("incorrect");
              
              // Update last detected note and time for incorrect notes
              setLastDetectedNote(playedNote);
              setLastNoteTime(currentTime);
              
              // Reset consecutive wrong detections after processing
              setConsecutiveWrongDetections(0);
              
              onIncorrectNote && onIncorrectNote();
              return; // Exit early for wrong notes
            }
          } else {
            // Reset consecutive wrong detections for correct notes
            setConsecutiveWrongDetections(0);
            // Increment consecutive detections for correct notes
            setConsecutiveDetections(prev => prev + 1);
            console.log(`[FREQ FILTER] Correct note detected: ${playedNote}, consecutive: ${consecutiveDetections + 1}`);
          }
          
          // 3. Only process correct notes if we have enough consecutive detections
          if (playedNote === expectedNote && consecutiveDetections < requiredConsecutiveDetections - 1) {
            shouldProcessNote = false;
          }
          
          // Debug logging for open strings
          if (highlightedNotes && highlightedNotes.length > 0 && highlightedNotes[0].fretNum === 0) {
            console.log(`[OPEN STRING DEBUG] Expected: ${expectedNote}, Detected: ${playedNote}, Match: ${playedNote === expectedNote}`);
            console.log(`[OPEN STRING DEBUG] Highlighted notes:`, highlightedNotes);
          }
          
          console.log(`[NOTE DETECTION] Expected: ${expectedNote}, Detected: ${playedNote}, Match: ${playedNote === expectedNote}, Should Process: ${shouldProcessNote}`);
          
          if (shouldProcessNote && playedNote === expectedNote) {
            console.log(`[NOTE DETECTION] CORRECT! Calling onCorrectNote`);
            setLastFeedback("correct");
            
            // Update last detected note and time
            setLastDetectedNote(playedNote);
            setLastNoteTime(currentTime);
            
            // Calculate timing accuracy based on when the note should be played
            let timingAccuracy = 0;
            if (highlightedNotes && highlightedNotes.length > 0) {
              // Calculate timing based on when the note should be played vs when it was detected
              const expectedPlayTime = Date.now(); // This would be calculated based on the note's scheduled time
              timingAccuracy = Math.floor(Math.random() * 200) - 100; // Simulate ±100ms timing
            }
            
            onCorrectNote && onCorrectNote(timingAccuracy);
          }
        }, [note, expectedNote, onCorrectNote, onIncorrectNote, highlightedNotes, lastDetectedNote, lastNoteTime, consecutiveDetections]);
                return (
          <div className="guitar-video-container" style={{ 
            position: 'relative', 
            width: 900, 
            height: 540, 
            margin: 'auto',
            borderRadius: '0px',
            background: 'transparent'
          }}>
            {/* Main video/canvas always shown when streaming */}
            <>
              <video
                id="video"
                ref={videoRef}
                className="guitar-video"
                playsInline
                muted
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
              />
              <canvas
                id="canvas"
                ref={canvasRef}
                className="guitar-canvas"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
              />
              {/* Fallback when video not loaded */}
              {!videoLoaded && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '1.2rem',
                  zIndex: 3
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📹</div>
                    <div>Camera Loading...</div>
                    <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.7 }}>
                      Please allow camera access
                    </div>
                  </div>
                </div>
              )}
              
              {/* AudioPitchDetector overlayed in video-container */}
              <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 4 }}>
                <div className="guitar-audio-note-panel">
                  <div className="audio-note-label">🎤 Play Along</div>
                  <div className="audio-note-value">
                    Exp: <span style={{ color: "#1976d2", fontWeight: 700 }}>{expectedNote || "-"}</span>
                  </div>
                  <div className="audio-freq-value">
                    Det: <span style={{ color: lastFeedback === "correct" ? "#4caf50" : lastFeedback === "incorrect" ? "#e53935" : "#222", fontWeight: 700 }}>
                      {note ? note.replace(/\d+$/, "") : (listening ? "Listening..." : "-")}
                    </span>
                  </div>
                  {lastFeedback && (
                    <div style={{ 
                      color: lastFeedback === "correct" ? "#4caf50" : "#e53935", 
                      fontWeight: 700,
                      fontSize: "1.2em"
                    }}>
                      {lastFeedback === "correct" ? "✔️ Correct!" : "✖️ Incorrect!"}
                    </div>
                  )}
                  {error && <div className="audio-warning">{error}</div>}
                  <div className="audio-controls">
                    {!listening ? (
                      <button className="start-btn" onClick={start}>Start Audio</button>
                    ) : (
                      <button className="stop-btn" onClick={stop}>Stop Audio</button>
                    )}
                  </div>
                </div>
              </div>
            </>
          </div>
        );
      }}
    </AudioPitchDetector>
  );
}

export default PlayAlongOverlay; 