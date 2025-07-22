import React, { useEffect, useRef, useMemo, useState } from "react";
import { InferenceEngine, CVImage } from "inferencejs";

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

// Helper to apply calibrated filter to a canvas
function applyCalibratedFilterToCanvas(srcVideo, filterObj) {
  if (!filterObj || !filterObj.filter || filterObj.filter === 'none') return null;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = srcVideo.videoWidth || FRETBOARD_WIDTH;
  tempCanvas.height = srcVideo.videoHeight || FRETBOARD_HEIGHT;
  const ctx = tempCanvas.getContext('2d');
  ctx.drawImage(srcVideo, 0, 0, tempCanvas.width, tempCanvas.height);
  const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;
  switch (filterObj.filter) {
    case 'grayscale':
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = data[i + 1] = data[i + 2] = avg;
      }
      break;
    case 'brightness':
      const brightness = filterObj.param !== null ? filterObj.param : 50;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] + brightness);
        data[i + 1] = Math.min(255, data[i + 1] + brightness);
        data[i + 2] = Math.min(255, data[i + 2] + brightness);
      }
      break;
    case 'contrast':
      const contrast = filterObj.param !== null ? filterObj.param : 50;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
        data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
        data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
      }
      break;
    case 'invert':
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
      break;
    default:
      break;
  }
  ctx.putImageData(imageData, 0, 0);
  return tempCanvas;
}

function PlayAlongOverlay() {
  const videoRef = useRef();
  const canvasRef = useRef();
  const inferEngine = useMemo(() => new InferenceEngine(), []);
  const [modelWorkerId, setModelWorkerId] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [lastFrets, setLastFrets] = useState([]);

  // Calibration state (copied from GuitarObjDetection)
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState('');
  const [calibrationResult, setCalibrationResult] = useState(null);
  const [calibrationDone, setCalibrationDone] = useState(false);
  const [showCalibrationPrompt, setShowCalibrationPrompt] = useState(true);
  const [noGuitarDetected, setNoGuitarDetected] = useState(false);
  const calibrationCancelledRef = useRef(false);
  const [showOverridePrompt, setShowOverridePrompt] = useState(false);
  const [calibratedFilter, setCalibratedFilter] = useState(null);

  // Save/load calibrated filter to/from localStorage
  useEffect(() => {
    if (calibrationDone && calibratedFilter) {
      localStorage.setItem('calibratedFilter', JSON.stringify(calibratedFilter));
    }
  }, [calibrationDone, calibratedFilter]);
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

  // Start model worker
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

  // Start webcam
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

  // Calibration handler (copied from GuitarObjDetection)
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
    let best = { filter: 'none', param: null, avgConfidence: baselineConfidence, baseline: baselineConfidence };
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
          best = { filter: filter.name, param, avgConfidence: avgConfidence, baseline: baselineConfidence };
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
      localStorage.setItem('calibratedFilter', JSON.stringify(best));
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

  // Inference loop
  useEffect(() => {
    if (!modelWorkerId) return;
    let running = true;
    const detectFrame = () => {
      if (!running) return;
      const img = new CVImage(videoRef.current);
      inferEngine.infer(modelWorkerId, img).then((predictions) => {
        // Only keep fret detections
        setLastFrets(predictions);
        drawOverlay(predictions);
        setTimeout(detectFrame, 1000 / 6); // ~6 FPS
      });
    };
    detectFrame();
    return () => { running = false; };
    // eslint-disable-next-line
  }, [modelWorkerId]);

  // Overlay logic (copied from GuitarObjDetection, minus scale controls)
  function drawOverlay(predictions) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, FRETBOARD_WIDTH, FRETBOARD_HEIGHT);

    // Filter out hand detections and only show predictions with confidence > 0.8
    const filteredPredictions = predictions.filter(pred => pred.class !== 'Hand' && pred.confidence > 0.8);

    // Heuristic Rotation Correction
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

    // Dynamic scaling for distance
    let avgFretHeight = 60;
    if (filteredPredictions.length > 0) {
      avgFretHeight = filteredPredictions.reduce((sum, pred) => sum + pred.bbox.height, 0) / filteredPredictions.length;
    }
    const scaleFactor = Math.max(0.5, Math.min(1.5, avgFretHeight / 60));
    const dotRadius = 6 * scaleFactor;
    const fontSize = 9 * scaleFactor;

    // Draw all detected frets/zones
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
        let yString = yCenter - height / 2 + (stringIdx * height) / 5;
        let xFret = xCenter;
        let dx = 0;
        let dy = yString - yCenter;
        let xRot = xCenter + dx * Math.cos(angle) - dy * Math.sin(angle);
        let yRot = yCenter + dx * Math.sin(angle) + dy * Math.cos(angle);

        ctx.beginPath();
        ctx.arc(xRot, yRot, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1976d2';
        ctx.fill();
        ctx.closePath();

        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = 'white';
        ctx.fillText(`F${fretNum}`, xRot + 7 * scaleFactor, yRot + 3 * scaleFactor);
      }
    }
  }

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