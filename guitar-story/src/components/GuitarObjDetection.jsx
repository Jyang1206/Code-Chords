import { InferenceEngine, CVImage } from "inferencejs";
import { useEffect, useRef, useState, useMemo, useContext } from "react";
import { useTheme } from "../contexts/ThemeContext";
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

// Display labels for the scale picker (display only)
const SCALE_LABELS = {
  major: 'Major',
  minor: 'Minor',
  pentatonic_major: 'Major pentatonic',
  pentatonic_minor: 'Minor pentatonic',
  blues: 'Blues',
};

const MicGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
    <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" />
  </svg>
);

// --- Fretboard Logic ---
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; // All 12 notes
const OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']; // 6th to 1st string

//Intervals for each scale
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

// --- End Fretboard Logic ---


//Detection of Guitar Frets using Roboflow YOLOv8 model
function GuitarObjDetection() {
  const { theme } = useTheme();

  const inferEngine = useMemo(() => {
    return new InferenceEngine();
  }, []);
  const [modelWorkerId, setModelWorkerId] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);

  const videoRef = useRef();
  const canvasRef = useRef();

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

  // Add state to control debug canvas visibility
  const [showDebugCanvas, setShowDebugCanvas] = useState(false);
  
  // Add state to track frame transmission status
  const [frameStatus, setFrameStatus] = useState('idle');
  const [frameCount, setFrameCount] = useState(0);
  const [lastFrameTime, setLastFrameTime] = useState(null);
  
  // Add stable reference to track current calibration state for debug canvas
  const currentCalibrationRef = useRef(null);

  // --- Use refs to always access latest state in async callbacks ---
  const selectedRootRef = useRef(selectedRoot);
  const selectedScaleRef = useRef(selectedScale);
  const scaleNotesRef = useRef(scaleNotes);
  const preprocessingOptionsRef = useRef(preprocessingOptions);
  useEffect(() => { selectedRootRef.current = selectedRoot; }, [selectedRoot]);
  useEffect(() => { selectedScaleRef.current = selectedScale; }, [selectedScale]);
  useEffect(() => { scaleNotesRef.current = scaleNotes; }, [scaleNotes]);
  useEffect(() => { preprocessingOptionsRef.current = preprocessingOptions; }, [preprocessingOptions]);

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
    setStreamStatus("Video stream stopped");
  };

  // Ensure latest scaleNotes and selectedRoot/selectedScale are used in detectFrame
  useEffect(() => {
    // Redraw overlay when scale changes
    if (canvasRef.current && videoRef.current && modelWorkerId) {
      // Force a redraw by calling detectFrame once
      detectFrame(true);
    }
  }, [selectedRoot, selectedScale]);

  // Draw overlay using latest scaleNotes and selectedRoot
  const drawOverlay = (predictions) => {
    if (!canvasRef.current) return;
    var ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const CONFIDENCE_THRESHOLD = 0.8;
    // Filter out hand detections and only show predictions with confidence > CONFIDENCE_THRESHOLD
    const filteredPredictions = predictions.filter(pred => pred.class !== 'Hand' && pred.confidence > CONFIDENCE_THRESHOLD);

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

        //Conditionals to check if notes are root or in selected scale
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

  // --- Modified detectFrame to use calibrated filter ---
  const detectFrame = async (forceRedraw = false) => {
    if (!modelWorkerId || !calibrationDone || calibrating) {
      return;
    }
    // Only run if video is ready
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || videoRef.current.readyState < 2) {
      setTimeout(detectFrame, 100 / 3);
      return;
    }
    if (forceRedraw) {
      if (window._lastPredictions && calibrationDone && !calibrating) {
        if (!canvasRef.current) return;
        drawOverlay(window._lastPredictions);
      }
      requestAnimationFrame(() => detectFrame(true)); // for continuous redraw
      return;
    }
    if (!canvasRef.current) return;
    
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
        console.log('Applying calibrated filters to inference:', stableCalibration.filterChain);
        console.log('Filter chain details:', stableCalibration.filterChain.map(f => `${f.filter}(${f.param})`));
        
        // Test the function with a simple filter first
        console.log('Testing applyFilterChainToCanvas function...');
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 100;
        testCanvas.height = 100;
        const testCtx = testCanvas.getContext('2d');
        testCtx.fillStyle = 'red';
        testCtx.fillRect(0, 0, 100, 100);
        
        try {
          const testResult = applyFilterChainToCanvas(testCtx, [{ filter: 'brightness', param: 1.2 }], CALIBRATION_FILTERS);
          console.log('Test filter application successful:', testResult);
        } catch (testError) {
          console.error('Test filter application failed:', testError);
        }
        
        // Get the context of the temp canvas for filter application
        const tempCtx = tempCanvas.getContext('2d');
        applyFilterChainToCanvas(tempCtx, stableCalibration.filterChain, CALIBRATION_FILTERS);
        processedCanvas = tempCanvas;
        console.log('Calibrated filters applied successfully to inference');
        console.log('Processed canvas dimensions:', processedCanvas.width, 'x', processedCanvas.height);
      } catch (error) {
        console.error('Error applying calibrated filters:', error);
        // Fall back to unprocessed canvas
        processedCanvas = tempCanvas;
        console.log('Falling back to unprocessed canvas due to error');
      }
    } else {
      console.log('No calibrated filters to apply to inference - stableCalibration:', stableCalibration);
    }
    
    // Create ImageBitmap from the processed canvas
    let imgBitmap = null;
    try {
      imgBitmap = await createImageBitmap(processedCanvas);
    } catch (e) {
      console.warn('Failed to create ImageBitmap for live inference', e);
      setTimeout(detectFrame, 100 / 3);
      return;
    }
    
    // Update debug canvas to show what's being sent to Roboflow
    const debugCanvas = document.getElementById('debug-roboflow-canvas');
    if (debugCanvas) {
      const debugCtx = debugCanvas.getContext('2d');
      debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
      debugCtx.drawImage(processedCanvas, 0, 0, debugCanvas.width, debugCanvas.height);
      
      // Use stable calibration reference to prevent jumping
      const stableCalibration = currentCalibrationRef.current;
      const hasStableFilters = stableCalibration && Array.isArray(stableCalibration.filterChain) && stableCalibration.filterChain.length > 0;
      
      // Add a label to show filter status
      debugCtx.fillStyle = 'white';
      debugCtx.font = '12px Arial';
      debugCtx.fillText('Sent to Roboflow', 10, 20);
      if (hasStableFilters) {
        debugCtx.fillStyle = '#4CAF50';
        debugCtx.fillText('Filters Applied', 10, 40);
        const filterText = stableCalibration.filterChain.map(f => `${f.filter}(${f.param})`).join(', ');
        debugCtx.fillText(filterText, 10, 60);
      } else {
        debugCtx.fillStyle = '#FF9800';
        debugCtx.fillText('No Filters', 10, 40);
      }
      
      // Add timestamp and frame info
      const now = new Date();
      const timestamp = now.toLocaleTimeString();
      debugCtx.fillStyle = '#FFD700';
      debugCtx.font = '10px Arial';
      debugCtx.fillText(`Frame: ${Date.now()}`, 10, 80);
      debugCtx.fillText(`Time: ${timestamp}`, 10, 95);
    }
    
    const img = new CVImage(imgBitmap);
    
    // Comprehensive logging for frame transmission
    const frameId = Date.now();
    const frameInfo = {
      id: frameId,
      timestamp: new Date().toISOString(),
      dimensions: `${imgBitmap.width}x${imgBitmap.height}`,
      hasFilters: hasStableFilters,
      filters: hasStableFilters ? stableCalibration.filterChain.map(f => `${f.filter}(${f.param})`) : [],
      modelWorkerId: modelWorkerId
    };
    
    console.log('SENDING FRAME TO ROBOTFLOW:', frameInfo);
    console.log('Frame details:', {
      width: imgBitmap.width,
      height: imgBitmap.height,
      filtersApplied: frameInfo.hasFilters,
      filterChain: frameInfo.filters,
      workerId: modelWorkerId
    });
    
    // Track frame sending in a global counter
    if (!window.frameSendCount) window.frameSendCount = 0;
    window.frameSendCount++;
    console.log(`Total frames sent: ${window.frameSendCount}`);
    
    // Update UI state
    setFrameStatus('sending');
    setFrameCount(window.frameSendCount);
    setLastFrameTime(new Date());
    
    inferEngine.infer(modelWorkerId, img).then((predictions) => {
      console.log('FRAME RECEIVED FROM ROBOTFLOW:', {
        frameId: frameId,
        timestamp: new Date().toISOString(),
        predictionsCount: predictions ? predictions.length : 0,
        predictions: predictions
      });
      
      // Update UI state for success
      setFrameStatus('success');
      
      // Update debug canvas with success indicator
      if (debugCanvas) {
        const debugCtx = debugCanvas.getContext('2d');
        debugCtx.fillStyle = '#4CAF50';
        debugCtx.font = '10px Arial';
        debugCtx.fillText('Success', 10, 110);
        debugCtx.fillText(`Frames: ${window.frameSendCount}`, 10, 125);
      }
      
      window._lastPredictions = predictions;
      if (calibrationDone && !calibrating) {
        drawOverlay(predictions);
      }
      setTimeout(detectFrame, 100 / 3); // Inference loop
    }).catch((error) => {
      console.error('FRAME SEND FAILED:', {
        frameId: frameId,
        timestamp: new Date().toISOString(),
        error: error.message
      });
      
      // Update UI state for error
      setFrameStatus('error');
      
      // Update debug canvas with error indicator
      if (debugCanvas) {
        const debugCtx = debugCanvas.getContext('2d');
        debugCtx.fillStyle = '#F44336';
        debugCtx.font = '10px Arial';
        debugCtx.fillText('Failed', 10, 110);
        debugCtx.fillText(`Error: ${error.message}`, 10, 125);
      }
      
      setTimeout(detectFrame, 100 / 3); // Continue loop even on error
    });
  };

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
      // Update the stable reference when calibration changes
      currentCalibrationRef.current = calibratedFilter;
    }
  }, [calibrationDone, calibratedFilter]);
  // On mount, load filterChain from localStorage if it exists
  useEffect(() => {
    const saved = localStorage.getItem('calibratedFilter');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('Loading calibrated filter from localStorage:', parsed);
        setCalibratedFilter(parsed);
        setCalibrationDone(true);
        // Update the stable reference
        currentCalibrationRef.current = parsed;
        console.log('Calibrated filter loaded successfully');
      } catch (error) {
        console.error('Error loading calibrated filter from localStorage:', error);
      }
    } else {
      console.log('No calibrated filter found in localStorage');
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

    setShowCalibrationPrompt(true);
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
      console.log('Calibration successful - saving filter chain:', best);
      setCalibratedFilter(best);
      setCalibrationDone(true);
    } else {
      setCalibrationProgress('Calibration failed: No filter achieved confidence >= 80%. Please adjust lighting or guitar position and try again.');
      console.log('Calibration failed - no filter achieved 80% confidence');
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
      setCalibratedFilter(null);
      // Automatically start calibration after confirmation
      setTimeout(() => {
        handleCalibration();
      }, 100);
    }
  }

  return (
    <div className={`practice-detect${theme.isDarkMode ? ' dark' : ' light'}`}>
      <div className="practice-stage">
        {/* ---------- Camera stage ---------- */}
        <div className="practice-stage-main">
          <div className="guitar-video-container practice-frame">
            {/* Main video/canvas always shown when streaming */}
            {isStreaming ? (
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
                {/* Overlay scale label on video */}
                <div className="guitar-scale-label-overlay" style={{ position: 'absolute', zIndex: 3 }}>
                  {selectedRootRef.current} {selectedScaleRef.current.replace('_', ' ')}
                </div>

                {/* Frame transmission status indicator */}
                {isStreaming && showDebugCanvas && (
                  <div style={{
                    position: 'absolute',
                    top: 56,
                    left: 16,
                    zIndex: 5,
                    background: 'rgba(5,6,15,0.82)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${
                      frameStatus === 'success' ? '#4CAF50' :
                      frameStatus === 'error' ? '#F44336' :
                      frameStatus === 'sending' ? '#FF9800' : '#666'
                    }`,
                    color: 'white',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor:
                          frameStatus === 'success' ? '#4CAF50' :
                          frameStatus === 'error' ? '#F44336' :
                          frameStatus === 'sending' ? '#FF9800' : '#666',
                        animation: frameStatus === 'sending' ? 'pulse 1s infinite' : 'none'
                      }}></span>
                      <span>
                        {frameStatus === 'success' ? 'Sent' :
                         frameStatus === 'error' ? 'Failed' :
                         frameStatus === 'sending' ? 'Sending' : 'Idle'}
                      </span>
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.8 }}>
                      Frames: {frameCount} | Last: {lastFrameTime ? lastFrameTime.toLocaleTimeString() : 'Never'}
                    </div>
                  </div>
                )}
                {/* Debug canvas to show frames sent to Roboflow */}
                {isStreaming && showDebugCanvas && (
                  <div className="debug-roboflow-container">
                    <canvas
                      id="debug-roboflow-canvas"
                      width={220}
                      height={124}
                      style={{ width: 220, height: 124, display: 'block' }}
                    />
                    <div className="debug-roboflow-label">
                      Calibrated view
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="guitar-video-placeholder">
                <svg className="guitar-video-placeholder-icon" viewBox="0 0 32 32" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="9" width="19" height="14" rx="3" />
                  <path d="M22 14l7-4v12l-7-4" />
                  <path d="M7 14h8M7 18h11" opacity=".45" />
                </svg>
                <div className="guitar-video-placeholder-text">
                  Start the camera to see your fretboard
                </div>
                {streamStatus && streamStatus.startsWith('Error') ? (
                  <div className="guitar-video-placeholder-error" role="alert">{streamStatus}</div>
                ) : (
                  <div className="guitar-video-placeholder-hint">
                    Hold the guitar so the neck runs across the frame. Your browser will ask for camera access.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Camera toolbar below the video/canvas */}
          <div className="practice-camera-bar">
            {!isStreaming ? (
              <button className="start-btn" onClick={() => setIsStreaming(true)}>
                Start camera
              </button>
            ) : (
              <button className="stop-btn" onClick={() => setIsStreaming(false)}>
                Stop camera
              </button>
            )}
            {isStreaming && (
              <button
                className={`toggle-debug-canvas-btn ${!showDebugCanvas ? 'hidden' : ''}`}
                onClick={() => setShowDebugCanvas(!showDebugCanvas)}
                aria-pressed={showDebugCanvas}
              >
                {showDebugCanvas ? 'Hide' : 'Show'} calibrated view
              </button>
            )}
            <span className="practice-camera-status" aria-live="polite">
              <span className={`practice-camera-dot${isStreaming ? ' is-live' : ''}`} aria-hidden="true" />
              {isStreaming ? 'Camera on' : 'Camera off'}
            </span>
          </div>
        </div>

        {/* ---------- Control rail ---------- */}
        <aside className="practice-rail" aria-label="Practice controls">
          {/* Heard-note readout */}
          <section className="practice-rail-group">
            {isStreaming ? (
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
                    <div className={`guitar-audio-note-panel${listening ? ' is-listening' : ''}`}>
                      <div className="audio-note-label">
                        <MicGlyph />
                        Heard note
                      </div>
                      <div className="audio-readout">
                        <div className="audio-note-value">{displayNote || '--'}</div>
                        <div className="audio-freq-value">{displayFreq ? displayFreq.toFixed(2) + ' Hz' : '-- Hz'}</div>
                      </div>
                      {!isInScale && noteName && (
                        <div className="audio-warning">
                          {noteName} isn't in {selectedRootRef.current} {selectedScaleRef.current.replace('_',' ')}
                        </div>
                      )}
                      {error && <div className="audio-warning">{error}</div>}
                      <div className="audio-controls">
                        {!listening ? (
                          <button className="start-btn" onClick={start}>Listen with microphone</button>
                        ) : (
                          <button className="stop-btn" onClick={stop}>Stop listening</button>
                        )}
                      </div>
                    </div>
                  );
                }}
              </AudioPitchDetector>
            ) : (
              <div className="guitar-audio-note-panel is-idle">
                <div className="audio-note-label">
                  <MicGlyph />
                  Heard note
                </div>
                <div className="audio-readout">
                  <div className="audio-note-value">--</div>
                  <div className="audio-freq-value">-- Hz</div>
                </div>
                <p className="practice-rail-hint">Start the camera, then turn on the microphone to hear which note you play.</p>
              </div>
            )}
          </section>

          {/* Scale controls */}
          <section className="guitar-scale-controls practice-rail-group">
            <div className="guitar-scale-btns-row">
              <div className="guitar-root-notes" role="group" aria-labelledby="practice-key-label">
                <span className="practice-rail-label" id="practice-key-label">Key</span>
                <div className="practice-segmented practice-segmented--keys">
                  {ROOT_NOTES.map(note => (
                    <button
                      key={note}
                      className={`guitar-scale-btn${selectedRoot === note ? ' active' : ''}`}
                      onClick={() => setSelectedRoot(note)}
                      aria-pressed={selectedRoot === note}
                    >
                      {note}
                    </button>
                  ))}
                </div>
              </div>
              <div className="guitar-scale-types" role="group" aria-labelledby="practice-scale-label">
                <span className="practice-rail-label" id="practice-scale-label">Scale</span>
                <div className="practice-segmented practice-segmented--scales">
                  {SCALE_TYPES.map(type => (
                    <button
                      key={type}
                      className={`guitar-scale-btn${selectedScale === type ? ' active' : ''}`}
                      onClick={() => setSelectedScale(type)}
                      aria-pressed={selectedScale === type}
                    >
                      {SCALE_LABELS[type] || type.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="guitar-current-scale">
              <span className="practice-rail-label">Notes in this scale</span>
              <div className="guitar-scale-notes" aria-label={`Notes: ${scaleNotes.join(', ')}`}>
                {scaleNotes.map(n => (
                  <span key={n} className={`practice-note-chip${n === selectedRoot ? ' is-root' : ''}`}>{n}</span>
                ))}
              </div>
            </div>
          </section>

          {/* Calibration */}
          {(isStreaming || showOverridePrompt) && (
            <section className="practice-rail-group practice-calibration">
              <span className="practice-rail-label">Calibration</span>
              {isStreaming && showCalibrationPrompt && !calibrating && (
                <div className="practice-calibration-block">
                  <p>Put your whole guitar neck in frame, then calibrate so detection adjusts to your lighting.</p>
                  <button className="start-btn" onClick={handleCalibration} disabled={calibrating}>
                    Start calibration
                  </button>
                </div>
              )}
              {showOverridePrompt && (
                <div className="calibration-override-prompt practice-calibration-block">
                  <p>Recalibrate? Your current calibration will be replaced.</p>
                  <div className="practice-calibration-actions">
                    <button className="start-btn" onClick={() => handleOverrideConfirm(true)}>Yes, recalibrate</button>
                    <button className="stop-btn" onClick={() => handleOverrideConfirm(false)}>Keep current</button>
                  </div>
                </div>
              )}
              {isStreaming && calibrating && (
                <div className="practice-calibration-block">
                  <div className="space-progress-bar-bg" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={(calibrationProgress && calibrationProgress.percent) || 0}>
                    <div className="space-progress-bar-fill" style={{ width: `${(calibrationProgress && calibrationProgress.percent) || 0}%` }} />
                  </div>
                  <div className="practice-calibration-progress">
                    {typeof calibrationProgress === 'object' && calibrationProgress !== null ? calibrationProgress.text : calibrationProgress}
                  </div>
                  {noGuitarDetected && (
                    <div className="practice-calibration-alert" role="alert">No guitar found in the frame. Move it into view and retake the frame.</div>
                  )}
                  <div className="practice-calibration-actions">
                    <button className="stop-btn" onClick={handleStopCalibration}>
                      Stop calibrating
                    </button>
                    <button className="start-btn" onClick={handleRetakeFrame}>
                      Retake frame
                    </button>
                  </div>
                </div>
              )}
              {isStreaming && !calibrating && calibrationResult && calibrationDone && (
                <div className="practice-calibration-block">
                  <dl className="practice-calibration-result">
                    <div>
                      <dt>Before calibration</dt>
                      <dd>{calibrationResult.baseline ? (calibrationResult.baseline * 100).toFixed(1) + '%' : '--'}</dd>
                    </div>
                    <div>
                      <dt>After calibration</dt>
                      <dd>{calibrationResult.avgConfidence ? (calibrationResult.avgConfidence * 100).toFixed(1) + '%' : '--'}</dd>
                    </div>
                    <div className="is-wide">
                      <dt>Filter used</dt>
                      <dd>{Array.isArray(calibrationResult?.filterChain) ? calibrationResult.filterChain.map(f => `${f.filter} (${f.param})`).join(', ') : '--'}</dd>
                    </div>
                  </dl>
                  <button className="btn-ghost" onClick={handleRetakeFrame}>
                    Retake calibration frame
                  </button>
                </div>
              )}
              {isStreaming && !calibrating && !calibrationDone && calibrationProgress && calibrationProgress.toString().includes('No filter achieved confidence') && (
                <div className="practice-calibration-block practice-calibration-failed" role="alert">
                  <p><strong>Calibration couldn't lock on.</strong> No filter reached 80% confidence. Try brighter, even lighting and calibrate again.</p>
                  <button className="start-btn" onClick={() => setShowOverridePrompt(true)}>
                    Calibrate again
                  </button>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

export default GuitarObjDetection;