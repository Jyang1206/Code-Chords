import React, { useEffect, useRef, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AudioPitchDetector from "../utils/AudioPitchDetector";
import "../css/GuitarObjDetection.css";
import { calibrateDetection, CALIBRATION_FILTERS } from '../utils/calibrationUtils';
import { applyFilterChainToCanvas } from '../utils/imagePreprocessing';

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
  const navigate = useNavigate();
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

  // --- Calibration State for PlayAlongOverlay ---
  const [calibrationDone, setCalibrationDone] = useState(false);
  const [calibratedFilter, setCalibratedFilter] = useState(null);
  const currentCalibrationRef = useRef(null);

  // Load calibrated filter from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('calibratedFilter');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('PlayAlongOverlay: Loading calibrated filter from localStorage:', parsed);
        setCalibratedFilter(parsed);
        setCalibrationDone(true);
        currentCalibrationRef.current = parsed;
        console.log('PlayAlongOverlay: Calibrated filter loaded successfully');
        console.log('PlayAlongOverlay: Filter chain details:', parsed.filterChain ? parsed.filterChain.map(f => `${f.filter}(${f.param})`) : 'No filter chain');
      } catch (error) {
        console.error('PlayAlongOverlay: Error loading calibrated filter from localStorage:', error);
      }
    } else {
      console.log('PlayAlongOverlay: No calibrated filter found in localStorage');
    }
  }, []);

  // Debug function to verify calibrated filter usage
  const debugCalibratedFilter = () => {
    const stableCalibration = currentCalibrationRef.current;
    const hasStableFilters = stableCalibration && Array.isArray(stableCalibration.filterChain) && stableCalibration.filterChain.length > 0;
    
    console.log('=== PLAYALONGOVERLAY CALIBRATION DEBUG ===');
    console.log('Calibration Done:', calibrationDone);
    console.log('Calibrated Filter State:', calibratedFilter);
    console.log('Stable Calibration Ref:', stableCalibration);
    console.log('Has Stable Filters:', hasStableFilters);
    if (hasStableFilters) {
      console.log('Filter Chain:', stableCalibration.filterChain);
      console.log('Filter Details:', stableCalibration.filterChain.map(f => `${f.filter}(${f.param})`));
    }
    console.log('localStorage calibratedFilter:', localStorage.getItem('calibratedFilter'));
    console.log('==========================================');
  };

  // Function to navigate to GuitarObjDetection for calibration
  const handleCalibrateInGuitarObjDetection = () => {
    console.log('PlayAlongOverlay: User wants to calibrate in GuitarObjDetection');
    
    const action = calibrationDone ? 'recalibrate' : 'calibrate';
    const message = `Would you like to ${action} your guitar detection? You'll be redirected to the Practice page where you can ${action} your setup.`;
    
    if (window.confirm(message)) {
      console.log(`PlayAlongOverlay: Navigating to Practice page for ${action}`);
      navigate('/practice');
    } else {
      console.log('PlayAlongOverlay: User cancelled navigation');
    }
  };

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
          // Use actual video dimensions like GuitarObjDetection
          videoRef.current.width = videoRef.current.videoWidth;
          videoRef.current.height = videoRef.current.videoHeight;
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
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
            videoRef.current.width = width;
            videoRef.current.height = height;
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, width, height);
            console.log('✅ Canvas initialized with dimensions:', width, 'x', height);
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
    const detectFrame = async () => {
      if (!running) return;
      try {
        // Create a temporary canvas for preprocessing
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = videoRef.current.videoWidth;
        tempCanvas.height = videoRef.current.videoHeight;
        
        // Draw the current video frame to the temp canvas
        tempCtx.drawImage(videoRef.current, 0, 0);
        
        // Apply calibrated filters if available
        let processedCanvas = tempCanvas;
        const stableCalibration = currentCalibrationRef.current;
        const hasStableFilters = stableCalibration && Array.isArray(stableCalibration.filterChain) && stableCalibration.filterChain.length > 0;
        
        if (hasStableFilters) {
          try {
            console.log('PlayAlongOverlay: Applying calibrated filters to inference:', stableCalibration.filterChain);
            console.log('PlayAlongOverlay: Filter details:', stableCalibration.filterChain.map(f => `${f.filter}(${f.param})`));
            applyFilterChainToCanvas(tempCtx, stableCalibration.filterChain, CALIBRATION_FILTERS);
            processedCanvas = tempCanvas;
            console.log('PlayAlongOverlay: Calibrated filters applied successfully to inference');
            console.log('PlayAlongOverlay: Processed canvas dimensions:', processedCanvas.width, 'x', processedCanvas.height);
          } catch (error) {
            console.error('PlayAlongOverlay: Error applying calibrated filters:', error);
            processedCanvas = tempCanvas;
          }
        } else {
          console.log('PlayAlongOverlay: No calibrated filters to apply to inference');
          console.log('PlayAlongOverlay: stableCalibration:', stableCalibration);
        }
        
        // Create ImageBitmap from the processed canvas
        let imgBitmap = null;
        try {
          imgBitmap = await createImageBitmap(processedCanvas);
        } catch (e) {
          console.warn('PlayAlongOverlay: Failed to create ImageBitmap for live inference', e);
          setTimeout(detectFrame, 1000 / 6);
          return;
        }
        
        const img = new CVImage(imgBitmap);
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
    if (!canvasRef.current) return;
    var ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

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

    // Encapsulate all displayed notes
    const displayedNotes = [];
    const safeHighlightedNotes = Array.isArray(highlightedNotes) ? highlightedNotes : [];
    const safeArpeggioNotes = Array.isArray(arpeggioNotes) ? arpeggioNotes : [];

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
        
        // For arpeggio/highlight matching, convert from 1-6 (CHORDS) to 0-5 (overlay)
        const arpeggioStringIdx = 6 - stringIdx; // Convert 0-5 to 1-6 (inverted)
        
        // Highlight if in highlightedNotes (compare using arpeggioStringIdx)
        // For open strings (fret 0 in chord data), match against fret 1 position
        let isHighlighted = safeHighlightedNotes.some(n => {
          if (n && n.stringIdx === arpeggioStringIdx) {
            // If chord note is open (fret 0), match against fret 1 position
            if (n.fretNum === 0) {
              return fretNum === 1;
            }
            // Otherwise match exact fret
            return n.fretNum === fretNum;
          }
          return false;
        });
        
        let isArpeggio = false;
        let isRoot = false;
        if (safeArpeggioNotes && safeArpeggioNotes.length > 0 && currentStep < safeArpeggioNotes.length) {
          const step = safeArpeggioNotes[currentStep];
          if (step && step.stringIdx === arpeggioStringIdx) {
            // If chord note is open (fret 0), match against fret 1 position
            if (step.fretNum === 0) {
              isArpeggio = fretNum === 1;
            } else {
              isArpeggio = step.fretNum === fretNum;
            }
            isRoot = step.isRoot && isArpeggio;
          }
        }

        // Store the note for later reference
        displayedNotes.push({
          fretNum: fretNum,
          stringIdx,
          noteName: noteName,
          x: xRot,
          y: yRot,
          isArpeggio,
          isRoot,
          isHighlighted
        });

        // Draw with different colors but same scaling/location logic as GuitarObjDetection
        if (isHighlighted) {
          ctx.beginPath();
          ctx.arc(xRot, yRot, scaleRadius, 0, 2 * Math.PI);
          ctx.fillStyle = '#FFD600'; // Yellow for highlighted
          ctx.fill();
          ctx.closePath();
        } else if (isRoot) {
          ctx.beginPath();
          ctx.arc(xRot, yRot, rootRadius, 0, 2 * Math.PI);
          ctx.fillStyle = '#e53935'; // Red for root
          ctx.fill();
          ctx.closePath();
        } else if (isArpeggio) {
          ctx.beginPath();
          ctx.arc(xRot, yRot, scaleRadius, 0, 2 * Math.PI);
          ctx.fillStyle = '#1976d2'; // Blue for arpeggio
          ctx.fill();
          ctx.closePath();
        } else {
          ctx.beginPath();
          ctx.arc(xRot, yRot, nonScaleRadius, 0, 2 * Math.PI);
          ctx.fillStyle = 'grey'; // Grey for other notes
          ctx.fill();
          ctx.closePath();
        }
        
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = 'white';
        ctx.fillText(noteName, xRot + 7 * scaleFactor, yRot + 3 * scaleFactor);
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
          <div className="guitar-video-container">
            {/* Main video/canvas always shown when streaming */}
            <>
              <video
                id="video"
                ref={videoRef}
                className="guitar-video"
                playsInline
                muted
              />
              <canvas
                id="canvas"
                ref={canvasRef}
                className="guitar-canvas"
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
                  
                  {/* Calibration Status and Debug */}
                  <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                      Calibration Status:
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: calibrationDone ? '#4CAF50' : '#FF9800',
                      fontWeight: 'bold'
                    }}>
                      {calibrationDone ? '✅ Calibrated' : '⚠️ Not Calibrated'}
                    </div>
                    {calibrationDone && currentCalibrationRef.current && (
                      <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                        Filters: {currentCalibrationRef.current.filterChain ? 
                          currentCalibrationRef.current.filterChain.map(f => `${f.filter}(${f.param})`).join(', ') : 
                          'None'}
                      </div>
                    )}
                    <div style={{ marginTop: '8px' }}>
                      <button 
                        style={{ 
                          fontSize: '9px', 
                          padding: '2px 6px', 
                          background: '#1976d2', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                        onClick={handleCalibrateInGuitarObjDetection}
                      >
                        {calibrationDone ? 'Recalibrate' : 'Calibrate'}
                      </button>
                    </div>
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