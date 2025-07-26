import React, { useEffect, useRef, useMemo, useState } from "react";
import AudioPitchDetector from "../utils/AudioPitchDetector";
import GuitarCanvas from "./GuitarCanvas";
import "../css/GuitarCanvas.css";

const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']; // 6th to 1st string

function getNoteAtPosition(stringIdx, fretNum) {
  const openNoteIdx = ALL_NOTES.indexOf(OPEN_STRINGS[stringIdx]);
  const noteIdx = (openNoteIdx + fretNum) % 12;
  return ALL_NOTES[noteIdx];
}

function PlayAlongOverlay({ arpeggioNotes = [], currentStep = 0, highlightedNotes = [], onCorrectNote, onIncorrectNote }) {
  const [expectedNote, setExpectedNote] = useState(null);
  const [lastFeedback, setLastFeedback] = useState(null);
  const displayedNotesRef = useRef([]); // Store displayed notes for later reference
  
  // Add frequency filtering state
  const [lastDetectedNote, setLastDetectedNote] = useState(null);
  const [lastNoteTime, setLastNoteTime] = useState(0);
  const [noteDetectionWindow, setNoteDetectionWindow] = useState(500); // ms window for note detection
  const [frequencyThreshold, setFrequencyThreshold] = useState(0.3); // minimum frequency amplitude to consider
  const [consecutiveDetections, setConsecutiveDetections] = useState(0);
  const [requiredConsecutiveDetections, setRequiredConsecutiveDetections] = useState(3); // require 3 consecutive detections

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
    console.log('PlayAlongOverlay drawOverlay called with predictions:', predictions);
    const canvas = document.getElementById('canvas');
    if (!canvas) {
      console.error('Canvas not found');
      return;
    }
    const ctx = canvas.getContext("2d");
    
    // Debug: Check canvas dimensions
    console.log(`[CANVAS DEBUG] Canvas dimensions: ${canvas.width}x${canvas.height}`);
    console.log(`[CANVAS DEBUG] Canvas style dimensions: ${canvas.style.width}x${canvas.style.height}`);
    
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
    
    // No scaling needed - canvas matches video size
    console.log('[NO SCALING] Canvas matches video size, using coordinates directly');
    
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
    
    // TEST: Check if we're about to start drawing
    console.log('[TEST] About to start drawing loop');
    
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
      
      // Use original coordinates - no scaling needed
      let xCenter = prediction.bbox.x;
      let yCenter = prediction.bbox.y;
      let width = prediction.bbox.width;
      let height = prediction.bbox.height;
      
      console.log(`[NO SCALE] Using original coordinates: (${xCenter.toFixed(1)}, ${yCenter.toFixed(1)})`);
      
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
        
        // Debug: Log what's being drawn
        if (fretNum <= 3) { // Only log first few frets to avoid spam
          console.log(`[DRAW DEBUG] Drawing note: ${noteName} at (${drawX.toFixed(1)}, ${yRot.toFixed(1)}) - Highlighted: ${isHighlighted}, Arpeggio: ${isArpeggio}, Root: ${isRoot}, Color: ${ctx.fillStyle}`);
          console.log(`[COORDINATE DEBUG] xCenter: ${xCenter.toFixed(1)}, yCenter: ${yCenter.toFixed(1)}, width: ${width.toFixed(1)}, height: ${height.toFixed(1)}`);
        }
      }
    }
    displayedNotesRef.current = displayedNotes;
    console.log(`[DRAW SUMMARY] Drew ${displayedNotes.length} notes total`);
  }

  return (
    <GuitarCanvas 
      onPredictions={drawOverlay}
      showCalibration={true}
      showPreprocessedView={false}
      showDebugCanvas={false}
    >
      <AudioPitchDetector>
        {({ note, frequency, listening, start, stop, error }) => {
          // Auto-start pitch detection when component mounts
          React.useEffect(() => {
            // Start audio detection automatically
            start();
            
            // Cleanup on unmount
            return () => {
              stop();
            };
          }, []); // Empty dependency array - only run once on mount
          
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
            
            // 2. Handle wrong notes immediately (no consecutive detection required)
            if (playedNote !== expectedNote) {
              // Reset consecutive detections for wrong notes
              setConsecutiveDetections(0);
              console.log(`[FREQ FILTER] Wrong note detected: ${playedNote}, expected: ${expectedNote}`);
              
              // Process wrong notes immediately
              if (shouldProcessNote) {
                console.log(`[NOTE DETECTION] INCORRECT! Calling onIncorrectNote`);
                setLastFeedback("incorrect");
                
                // Update last detected note and time for incorrect notes
                setLastDetectedNote(playedNote);
                setLastNoteTime(currentTime);
                
                onIncorrectNote && onIncorrectNote();
                return; // Exit early for wrong notes
              }
            } else {
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
            <div className="play-along-feedback-panel">
              <div className="feedback-header">
                <span className="feedback-title">🎸 Play Along</span>
              </div>
              <div className="feedback-content">
                <div className="note-display">
                  <span className="note-label">Expected:</span>
                  <span className="expected-note">{expectedNote || "-"}</span>
                  <span className="note-separator">•</span>
                  <span className="note-label">Detected:</span>
                  <span className={`detected-note ${lastFeedback === "correct" ? "correct" : lastFeedback === "incorrect" ? "incorrect" : ""}`}>
                    {note ? note.replace(/\d+$/, "") : (listening ? "Listening..." : "-")}
                  </span>
                  <span className={`feedback-icon ${lastFeedback === "correct" ? "correct" : lastFeedback === "incorrect" ? "incorrect" : ""}`}>
                    {lastFeedback === "correct" ? "✔️" : lastFeedback === "incorrect" ? "✖️" : ""}
                  </span>
                </div>
                {error && (
                  <div className="feedback-error">{error}</div>
                )}
                <div className={`audio-status ${listening ? 'listening' : 'stopped'}`}>
                  {listening ? '🎤 Listening...' : '🔇 Audio Off'}
                </div>
              </div>
            </div>
          );
        }}
      </AudioPitchDetector>
    </GuitarCanvas>
  );
}

export default PlayAlongOverlay; 