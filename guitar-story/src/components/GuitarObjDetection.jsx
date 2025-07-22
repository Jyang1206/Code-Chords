import { InferenceEngine, CVImage } from "inferencejs";
import { useEffect, useRef, useState, useMemo, useContext } from "react";
import { ThemeContext } from "../App";
import "../css/GuitarObjDetection.css";
import AudioPitchDetector from "../utils/AudioPitchDetector";
import {
  adjustBrightnessContrast,
  gammaCorrection,
  gaussianBlur,
  sharpen,
  grayscale,
  histogramEqualization,
  clahe,
  colorNormalization,
  autoWhiteBalance
} from "../utils/imagePreprocessing";

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

  const inferEngine = useMemo(() => {
    return new InferenceEngine();
  }, []);
  const [modelWorkerId, setModelWorkerId] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);

  const videoRef = useRef();
  const canvasRef = useRef();
  const preprocessedCanvasRef = useRef();

  // --- Preprocessing Filter State ---
  const [filter, setFilter] = useState('none');
  const FILTERS = ['none', 'grayscale', 'brightness', 'contrast', 'invert'];

  // --- Streaming state ---
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("Ready to start video stream");
  let mediaStreamRef = useRef(null);

  // --- Scale/Key Controls State ---
  const ROOT_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const SCALE_TYPES = ['major', 'minor', 'pentatonic_major', 'pentatonic_minor', 'blues'];
  const [selectedRoot, setSelectedRoot] = useState('C');
  const [selectedScale, setSelectedScale] = useState('major');
  const scaleNotes = useMemo(() => getScaleNotes(selectedRoot, selectedScale), [selectedRoot, selectedScale]);

  // --- Preprocessing Controls State ---
  const [preprocessingOptions, setPreprocessingOptions] = useState({
    adjustBrightnessContrast: false,
    gammaCorrection: false,
    gaussianBlur: false,
    sharpen: false,
    grayscale: false,
    histogramEqualization: false,
    clahe: false,
    colorNormalization: false,
    autoWhiteBalance: false,
  });

  const handlePreprocessingChange = (option) => {
    setPreprocessingOptions(prev => ({ ...prev, [option]: !prev[option] }));
  };

  // --- Fix: Use refs to always access latest state in async callbacks ---
  const selectedRootRef = useRef(selectedRoot);
  const selectedScaleRef = useRef(selectedScale);
  const scaleNotesRef = useRef(scaleNotes);
  const preprocessingOptionsRef = useRef(preprocessingOptions);
  useEffect(() => { selectedRootRef.current = selectedRoot; }, [selectedRoot]);
  useEffect(() => { selectedScaleRef.current = selectedScale; }, [selectedScale]);
  useEffect(() => { scaleNotesRef.current = scaleNotes; }, [scaleNotes]);
  useEffect(() => { preprocessingOptionsRef.current = preprocessingOptions; }, [preprocessingOptions]);
  // --- End fix ---

  // --- Confidence Tracking ---
  const confidenceStatsRef = useRef({ sum: 0, count: 0 });

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

  // Only start webcam when user clicks start
  useEffect(() => {
    if (isStreaming && modelWorkerId) {
      startWebcam();
    }
    // Stop webcam if isStreaming is set to false
    if (!isStreaming) {
      stopWebcam();
    }
    // eslint-disable-next-line
  }, [isStreaming, modelWorkerId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const startWebcam = () => {
    setStreamStatus("Starting video stream...");
    var constraints = {
      audio: false,
      video: {
        width: { ideal: 900 },
        height: { ideal: 540 },
        facingMode: "environment",
      },
    };

    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      mediaStreamRef.current = stream;
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
        setStreamStatus("Video stream active - detecting frets and notes...");
        detectFrame();
      };
    }).catch((err) => {
      setStreamStatus("Error accessing webcam: " + err.message);
      setIsStreaming(false);
    });
  };

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

  const stopWebcam = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    if (preprocessedCanvasRef.current) {
      const ctx = preprocessedCanvasRef.current.getContext("2d", { willReadFrequently: true });
      ctx.clearRect(0, 0, preprocessedCanvasRef.current.width, preprocessedCanvasRef.current.height);
    }
    setStreamStatus("Video stream stopped");
  };

  // Ensure latest scaleNotes and selectedRoot/selectedScale are used in detectFrame
  useEffect(() => {
    // Redraw overlay when scale changes
    if (canvasRef.current && videoRef.current && modelWorkerId) {
      // Force a redraw by calling detectFrame once
      detectFrame(true);
    }
    // eslint-disable-next-line
  }, [selectedRoot, selectedScale]);

  // Draw overlay using latest scaleNotes and selectedRoot
  const drawOverlay = (predictions) => {
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

  const applyFilterAndPreprocess = () => {
    if (!preprocessedCanvasRef.current || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
      return;
    }
    const preprocessedCtx = preprocessedCanvasRef.current.getContext('2d', { willReadFrequently: true });
    const width = videoRef.current.videoWidth;
    const height = videoRef.current.videoHeight;

    if (width === 0 || height === 0) return;
    
    preprocessedCanvasRef.current.width = width;
    preprocessedCanvasRef.current.height = height;
    preprocessedCtx.drawImage(videoRef.current, 0, 0, width, height);

    if (filter === 'none') return;
    
    const imageData = preprocessedCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      switch (filter) {
        case 'grayscale':
          const avg = (r + g + b) / 3;
          data[i] = data[i + 1] = data[i + 2] = avg;
          break;
        case 'brightness':
          const brightness = 50;
          data[i] = Math.min(255, r + brightness);
          data[i + 1] = Math.min(255, g + brightness);
          data[i + 2] = Math.min(255, b + brightness);
          break;
        case 'contrast':
          const contrast = 50;
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          data[i] = Math.max(0, Math.min(255, factor * (r - 128) + 128));
          data[i + 1] = Math.max(0, Math.min(255, factor * (g - 128) + 128));
          data[i + 2] = Math.max(0, Math.min(255, factor * (b - 128) + 128));
          break;
        case 'invert':
          data[i] = 255 - r;
          data[i + 1] = 255 - g;
          data[i + 2] = 255 - b;
          break;
        default:
          break;
      }
    }
    preprocessedCtx.putImageData(imageData, 0, 0);
  };

  // Modified detectFrame to include preprocessing
  const detectFrame = (forceRedraw = false) => {
    if (!modelWorkerId) {
      setTimeout(() => detectFrame(forceRedraw), 100 / 3);
      return;
    }

    // Always update the preprocessed canvas
    applyFilterAndPreprocess();

    if (forceRedraw) {
      if (window._lastPredictions) {
        if (!canvasRef.current) return;
        drawOverlay(window._lastPredictions);
      }
      requestAnimationFrame(() => detectFrame(true)); // for continuous redraw
      return;
    }

    if (!canvasRef.current) return;
    const img = new CVImage(videoRef.current);
    inferEngine.infer(modelWorkerId, img).then((predictions) => {
      window._lastPredictions = predictions;
      drawOverlay(predictions);
      setTimeout(detectFrame, 100 / 3); // Inference loop
    });
  };

   // Animation loop for preprocessed view
   useEffect(() => {
    let rafId;
    function drawPreprocessedLoop() {
      if (isStreaming) {
        applyFilterAndPreprocess();
        rafId = requestAnimationFrame(drawPreprocessedLoop);
      }
    }
    if (isStreaming) {
      rafId = requestAnimationFrame(drawPreprocessedLoop);
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isStreaming, filter]);


  return (
    <div className={`guitar-obj-detection${lightMode ? ' light' : ' dark'}`}>
      <div className="guitar-obj-detection-content">
        <div className="main-view-flex-container">
          <div className="guitar-video-container">
            {/* Video/Canvas or Placeholder */}
            {isStreaming ? (
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
                {/* Overlay scale label on video */}
                <div className="guitar-scale-label-overlay">
                  {selectedRootRef.current} {selectedScaleRef.current.replace('_', ' ')}
                </div>
                {/* AudioPitchDetector overlayed in video-container */}
                <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 3 }}>
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
                        <div className="guitar-audio-note-panel">
                          <div className="audio-note-label">🎤 Detected Note</div>
                          <div className="audio-note-value">{displayNote || '--'}</div>
                          <div className="audio-freq-value">{displayFreq ? displayFreq.toFixed(2) + ' Hz' : '--'}</div>
                          {!isInScale && noteName && (
                            <div className="audio-warning">
                              Note {noteName} is not in the {selectedRootRef.current} {selectedScaleRef.current.replace('_',' ')} scale!
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
                      );
                    }}
                  </AudioPitchDetector>
                </div>
              </>
            ) : (
              <div className="guitar-video-placeholder">
                <div className="guitar-video-placeholder-text">
                  {streamStatus || "Click 'Start Stream' to begin"}
                </div>
              </div>
            )}
          </div>

          <div className="preprocessed-view-container">
            <h3>Preprocessed View</h3>
            <canvas
              ref={preprocessedCanvasRef}
              className="preprocessed-canvas"
            />
            <div className="filter-controls">
              <label htmlFor="filter-select">Filter:</label>
              <select
                id="filter-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="filter-select"
              >
                {FILTERS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          {!isStreaming ? (
            <button className="start-btn" onClick={() => setIsStreaming(true)}>
              Start Stream
            </button>
          ) : (
            <button className="stop-btn" onClick={() => setIsStreaming(false)}>
              Stop Stream
            </button>
          )}
        </div>
        <div className="guitar-scale-controls">
          <h3>Scale Controls</h3>
          <div className="guitar-scale-btns-row">
            <div className="guitar-root-notes">
              <label>Root Note: </label>
              {ROOT_NOTES.map(note => (
                <button
                  key={note}
                  className={`guitar-scale-btn${selectedRoot === note ? ' active' : ''}`}
                  onClick={() => setSelectedRoot(note)}
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
                  onClick={() => setSelectedScale(type)}
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

        {/* --- Preprocessing Controls --- */}
        <div className="guitar-preprocessing-controls">
          <h3>Preprocessing Controls</h3>
          <div className="guitar-preprocessing-toggles">
            {Object.keys(preprocessingOptions).map(option => (
              <button
                key={option}
                className={`guitar-preprocessing-btn${preprocessingOptions[option] ? ' active' : ''}`}
                onClick={() => handlePreprocessingChange(option)}
              >
                {/* Format name for display, e.g., 'autoWhiteBalance' -> 'Auto White Balance' */}
                {option.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuitarObjDetection;
