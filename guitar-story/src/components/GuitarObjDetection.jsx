import { InferenceEngine, CVImage } from "inferencejs";
import { useEffect, useRef, useState, useMemo, useContext } from "react";
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
import { calibrateDetection, CALIBRATION_FILTERS } from '../utils/calibrationUtils';
import { applyFilterChainToCanvas } from '../utils/imagePreprocessing';

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

// Utility to apply a filter chain to a canvas context
// function applyFilterChainToCanvas(ctx, filterChain, filters) {
//   if (!filterChain || !Array.isArray(filterChain)) return;
//   for (const f of filterChain) {
//     const filterObj = filters.find(fl => fl.name === f.filter);
//     if (filterObj && filterObj.apply) {
//       filterObj.apply(ctx, f.param);
//     }
//   }
// }

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
  // In applyFilterAndPreprocess, always use calibratedFilter if calibration is done
  // Add state to track calibration status and selected filter
  const [calibrationDone, setCalibrationDone] = useState(false);
  const [calibratedFilter, setCalibratedFilter] = useState(null);

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

  // After model is loaded (wherever modelWorkerId or inferEngine is set):
  if (modelWorkerId && inferEngine) {
    console.log('Model loaded:', modelWorkerId);
  }

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

  // --- Modified applyFilterAndPreprocess to accept a filter param ---
  const applyFilterAndPreprocess = (filterOverride = null) => {
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

    // Always use the calibrated filterChain if available
    const filterChain = (calibrationDone && calibratedFilter && Array.isArray(calibratedFilter.filterChain)) ? calibratedFilter.filterChain : [];
    if (filterChain.length > 0) {
      applyFilterChainToCanvas(preprocessedCtx, filterChain, CALIBRATION_FILTERS);
    }
  };

  // --- Modified detectFrame to use calibrated filter ---
  const detectFrame = async (forceRedraw = false) => {
    if (!modelWorkerId || !calibrationDone || calibrating) {
      return;
    }
    applyFilterAndPreprocess(calibratedFilter);

    if (forceRedraw) {
      if (window._lastPredictions && calibrationDone && !calibrating) {
        if (!canvasRef.current) return;
        drawOverlay(window._lastPredictions);
      }
      requestAnimationFrame(() => detectFrame(true)); // for continuous redraw
      return;
    }

    if (!canvasRef.current) return;
    // Use preprocessedCanvasRef for inference
    let imgBitmap = null;
    try {
      imgBitmap = await createImageBitmap(preprocessedCanvasRef.current);
    } catch (e) {
      console.warn('Failed to create ImageBitmap for live inference', e);
      setTimeout(detectFrame, 100 / 3);
      return;
    }
    const img = new CVImage(imgBitmap);
    inferEngine.infer(modelWorkerId, img).then((predictions) => {
      console.log('Predictions:', predictions);
      window._lastPredictions = predictions;
      if (calibrationDone && !calibrating) {
        drawOverlay(predictions);
      }
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
  }, [isStreaming, calibrationDone, calibratedFilter]);

  // --- Calibration State ---
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState('');
  const [calibrationResult, setCalibrationResult] = useState(null);
  const [showCalibrationPrompt, setShowCalibrationPrompt] = useState(true);
  const [noGuitarDetected, setNoGuitarDetected] = useState(false);
  const calibrationCancelledRef = useRef(false);
  const [showOverridePrompt, setShowOverridePrompt] = useState(false);

  // On calibration complete, save filterChain to localStorage
  useEffect(() => {
    if (calibrationDone && calibratedFilter && Array.isArray(calibratedFilter.filterChain)) {
      localStorage.setItem('calibratedFilter', JSON.stringify(calibratedFilter));
    }
  }, [calibrationDone, calibratedFilter]);
  // On mount, load filterChain from localStorage if it exists
  useEffect(() => {
    const saved = localStorage.getItem('calibratedFilter');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCalibratedFilter(parsed);
        setCalibrationDone(true);
      } catch {}
    }
  }, []);

  // --- Inference Loop Control ---
  useEffect(() => {
    // Only run detectFrame if streaming and calibration is done and not calibrating
    if (isStreaming && calibrationDone && !calibrating) {
      detectFrame();
    }
    // eslint-disable-next-line
  }, [isStreaming, calibrationDone, calibrating, calibratedFilter, modelWorkerId]);

  // --- Calibration handler ---
  async function handleCalibration() {
    if ((calibrationDone || calibrationResult) && !showOverridePrompt) {
      setShowOverridePrompt(true);
      return;
    }
    setShowOverridePrompt(false);
    setCalibrating(true);
    setCalibrationProgress('Starting calibration...');
    setCalibrationResult(null);
    setCalibrationDone(false);
    setNoGuitarDetected(false);
    calibrationCancelledRef.current = false;

    // Use the same inference function as your main detection
    const runInference = async (canvasOrVideo) => {
      if (!modelWorkerId) return [];
      let inputCanvas = canvasOrVideo;
      // If a video element is passed, draw it to a temp canvas
      if (inputCanvas instanceof HTMLVideoElement) {
        if (!inputCanvas.videoWidth || !inputCanvas.videoHeight) return [];
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = inputCanvas.videoWidth;
        tempCanvas.height = inputCanvas.videoHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(inputCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
        inputCanvas = tempCanvas;
      }
      if (
        !(inputCanvas instanceof HTMLCanvasElement) ||
        !inputCanvas.width ||
        !inputCanvas.height ||
        !inputCanvas.getContext('2d')
      ) {
        console.warn('Calibration: Invalid canvas for inference', inputCanvas);
        return [];
      }
      let imgBitmap = null;
      try {
        imgBitmap = await createImageBitmap(inputCanvas);
      } catch (e) {
        console.warn('Failed to create ImageBitmap for inference', e);
        return [];
      }
      const img = new CVImage(imgBitmap);
      return await inferEngine.infer(modelWorkerId, img);
    };

    // Helper to allow retaking the frame
    let staticFrame = null;
    const takeCalibrationFrame = () => {
      if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) return null;
      const staticCanvas = document.createElement('canvas');
      staticCanvas.width = videoRef.current.videoWidth;
      staticCanvas.height = videoRef.current.videoHeight;
      const staticCtx = staticCanvas.getContext('2d', { willReadFrequently: true });
      staticCtx.drawImage(videoRef.current, 0, 0, staticCanvas.width, staticCanvas.height);
      return staticCanvas;
    };

    // Take initial frame
    staticFrame = takeCalibrationFrame();
    if (!staticFrame) {
      setCalibrationProgress('Failed to capture frame. Please try again.');
      setCalibrating(false);
      return;
    }

    // Run baseline detection to check for guitar and get baseline confidence
    const baselinePreds = await runInference(staticFrame);
    const baselineConfidence = (baselinePreds && baselinePreds.length > 0)
      ? baselinePreds.reduce((a, b) => a + b.confidence, 0) / baselinePreds.length
      : 0;
    if (!baselinePreds || baselinePreds.length === 0) {
      setNoGuitarDetected(true);
      setCalibrationProgress('NO GUITAR DETECTED');
      setCalibrating(false);
      return;
    }

    setShowCalibrationPrompt(false);
    setNoGuitarDetected(false);

    // Calibration logic (refactored to allow cancellation and require 80% confidence)
    let best = { filterChain: [], avgConfidence: baselineConfidence, baseline: baselineConfidence };
    const totalSteps = CALIBRATION_FILTERS.reduce((sum, f) => sum + f.params.length, 0);
    let currentStep = 0;
    let foundAbove80 = false;
    for (let i = 0; i < CALIBRATION_FILTERS.length; i++) {
      const filter = CALIBRATION_FILTERS[i];
      for (let j = 0; j < filter.params.length; j++) {
        if (calibrationCancelledRef.current) {
          setCalibrationProgress('Calibration cancelled.');
          setCalibrating(false);
          return;
        }
        const param = filter.params[j];
        currentStep++;
        const percent = Math.round((currentStep / totalSteps) * 100);
        const text = `Applying ${filter.name} (${param})...`;
        setCalibrationProgress({ percent, text });
        const avgConfidence = await (async () => {
          // Work on a copy of the static frame
          const testCanvas = document.createElement('canvas');
          testCanvas.width = staticFrame.width;
          testCanvas.height = staticFrame.height;
          const testCtx = testCanvas.getContext('2d', { willReadFrequently: true });
          testCtx.drawImage(staticFrame, 0, 0, testCanvas.width, testCanvas.height);
          if (filter.apply) filter.apply(testCtx, param);
          try {
            const predictions = await runInference(testCanvas);
            if (predictions && predictions.length > 0) {
              const avg = predictions.reduce((a, b) => a + b.confidence, 0) / predictions.length;
              return avg;
            }
          } catch (e) {
            console.warn('Calibration inference error:', e);
          }
          return 0;
        })();
        setCalibrationProgress({ percent, text: `Filter: ${filter.name} (${param}) - Avg confidence: ${(avgConfidence * 100).toFixed(1)}%` });
        if (avgConfidence > best.avgConfidence) {
          best = { filterChain: [...best.filterChain, { filter: filter.name, param }], avgConfidence: avgConfidence, baseline: baselineConfidence };
        }
        if (avgConfidence >= 0.8) {
          foundAbove80 = true;
        }
      }
    }
    setCalibrationResult(best);
    if (foundAbove80) {
      setCalibrationProgress('Calibration complete! (Found filter with confidence >= 80%)');
      setCalibratedFilter(best);
      setCalibrationDone(true);
    } else {
      setCalibrationProgress('Calibration failed: No filter achieved confidence >= 80%. Please adjust lighting or guitar position and try again.');
      setCalibratedFilter(null);
      setCalibrationDone(false);
    }
    setCalibrating(false);
  }

  function handleStopCalibration() {
    calibrationCancelledRef.current = true;
    setCalibrating(false);
    setCalibrationProgress('Calibration cancelled.');
  }

  function handleRetakeFrame() {
    setShowCalibrationPrompt(true);
    setNoGuitarDetected(false);
    setCalibrationProgress('');
    setCalibrationResult(null);
    setCalibrationDone(false);
  }

  function handleOverrideConfirm(confirm) {
    setShowOverridePrompt(false);
    if (confirm) {
      setShowCalibrationPrompt(true);
      setNoGuitarDetected(false);
      setCalibrationProgress('');
      setCalibrationResult(null);
      setCalibrationDone(false);
    }
  }

  return (
    <div className={`guitar-obj-detection${lightMode ? ' light' : ' dark'}`}>
      <div className="guitar-obj-detection-content">
        {/* Calibration UI */}
        {isStreaming && showCalibrationPrompt && !calibrating && (
          <div style={{ marginBottom: 24, textAlign: 'center', color: 'var(--space-accent)' }}>
            <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>Please put your guitar in frame before calibrating.</div>
            <button className="start-btn" onClick={handleCalibration} disabled={calibrating}>
              Start Calibration
            </button>
          </div>
        )}
        {showOverridePrompt && (
          <div className="calibration-override-prompt" style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>
              Are you sure you want to recalibrate?
            </div>
            <button className="start-btn" onClick={() => handleOverrideConfirm(true)} style={{ marginRight: 12 }}>Yes, recalibrate</button>
            <button className="stop-btn" onClick={() => handleOverrideConfirm(false)}>Cancel</button>
          </div>
        )}
        {isStreaming && calibrating && (
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <button className="stop-btn" onClick={handleStopCalibration} style={{ marginRight: 12 }}>
              Stop Calibration
            </button>
            <button className="start-btn" onClick={handleRetakeFrame}>
              Retake Frame
            </button>
            <div style={{ margin: '16px auto', width: 320, maxWidth: '90%' }}>
              <div className="space-progress-bar-bg">
                <div className="space-progress-bar-fill" style={{ width: `${(calibrationProgress && calibrationProgress.percent) || 0}%` }} />
              </div>
              <div style={{ marginTop: 6, color: 'var(--space-accent)', fontSize: 14, fontFamily: 'monospace' }}>
                {typeof calibrationProgress === 'object' && calibrationProgress !== null ? calibrationProgress.text : calibrationProgress}
              </div>
            </div>
            {noGuitarDetected && (
              <div style={{ color: 'red', marginTop: 12, fontWeight: 'bold' }}>NO GUITAR DETECTED</div>
            )}
          </div>
        )}
        {isStreaming && !calibrating && calibrationResult && calibrationDone && (
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <button className="start-btn" onClick={handleRetakeFrame}>
              Retake Calibration Frame
            </button>
            <div style={{ marginTop: 12, color: 'var(--space-accent)' }}>
              <strong>Baseline (No Preprocessing):</strong> {calibrationResult.baseline ? (calibrationResult.baseline * 100).toFixed(1) + '%' : '--'}<br/>
              <strong>Best Filter:</strong> {Array.isArray(calibrationResult?.filterChain) ? calibrationResult.filterChain.map(f => `${f.filter} (${f.param})`).join(', ') : '--'}<br/>
              <strong>Avg Confidence After Preprocessing:</strong> {calibrationResult.avgConfidence ? (calibrationResult.avgConfidence * 100).toFixed(1) + '%' : '--'}
            </div>
          </div>
        )}
        {isStreaming && !calibrating && !calibrationDone && calibrationProgress && calibrationProgress.toString().includes('No filter achieved confidence') && (
          <div style={{
            color: 'red',
            background: 'rgba(255,255,255,0.08)',
            border: '2px solid #ff61a6',
            borderRadius: 12,
            padding: '16px 24px',
            margin: '24px auto',
            maxWidth: 420,
            fontWeight: 'bold',
            fontSize: 18,
            textAlign: 'center',
            boxShadow: '0 0 16px 2px #ff61a6'
          }}>
            Calibration failed: No filter achieved confidence ≥ 80%.<br/>
            <span style={{ color: '#fff' }}>Please move to a location with better lighting and try again.</span>
            <div style={{ marginTop: 16 }}>
              <button className="start-btn" onClick={() => setShowOverridePrompt(true)}>
                Retry Calibration
              </button>
            </div>
          </div>
        )}
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
            {/* Show which filter is applied after calibration */}
            {calibrationDone && calibratedFilter && (
              <div style={{ marginTop: 8, color: 'var(--space-accent)', fontSize: 14 }}>
                <strong>Applied Filter:</strong> {Array.isArray(calibratedFilter?.filterChain) ? calibratedFilter.filterChain.map(f => `${f.filter} (${f.param})`).join(', ') : '--'}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          {!isStreaming ? (
            <button className="start-btn" onClick={() => setIsStreaming(true)}>
              Begin Practice
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
      </div>
    </div>
  );
}

export default GuitarObjDetection;
