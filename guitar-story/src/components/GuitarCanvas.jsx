import React, { useEffect, useRef, useState, useMemo, useContext } from "react";
import { ThemeContext } from "../App";
import "../css/GuitarCanvas.css";
import inferenceService, { CVImage } from "../services/inferenceService";
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

function getNoteAtPosition(stringIdx, fretNum) {
  const openNoteIdx = ALL_NOTES.indexOf(OPEN_STRINGS[stringIdx]);
  const noteIdx = (openNoteIdx + fretNum) % 12;
  return ALL_NOTES[noteIdx];
}

function GuitarCanvas({ 
  onPredictions, 
  drawOverlay, 
  children, 
  showCalibration = true,
  showPreprocessedView = false,
  showDebugCanvas = false,
  containerStyle = {},
  videoStyle = {},
  canvasStyle = {}
}) {
  const { lightMode } = useContext(ThemeContext);
  const [modelWorkerId, setModelWorkerId] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("Ready to start video stream");
  
  const videoRef = useRef();
  const canvasRef = useRef();
  const preprocessedCanvasRef = useRef();
  let mediaStreamRef = useRef(null);

  // --- Calibration State ---
  const [calibrationDone, setCalibrationDone] = useState(false);
  const [calibratedFilter, setCalibratedFilter] = useState(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState('');
  const [calibrationResult, setCalibrationResult] = useState(null);
  const [showCalibrationPrompt, setShowCalibrationPrompt] = useState(true);
  const [noGuitarDetected, setNoGuitarDetected] = useState(false);
  const calibrationCancelledRef = useRef(false);
  const [showOverridePrompt, setShowOverridePrompt] = useState(false);

  // Subscribe to inference service status
  useEffect(() => {
    const handleStatusUpdate = ({ workerId, isLoading }) => {
      setModelWorkerId(workerId);
      setModelLoading(isLoading);
    };

    inferenceService.subscribe(handleStatusUpdate);
    
    // Try to start the worker if not already started
    if (!modelWorkerId && !modelLoading) {
      inferenceService.startWorker().catch(error => {
        console.error('Failed to start inference worker:', error);
      });
    }

    return () => {
      inferenceService.unsubscribe(handleStatusUpdate);
    };
  }, [modelWorkerId, modelLoading]);

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

  // Only start webcam when user clicks start
  useEffect(() => {
    if (isStreaming && modelWorkerId) {
      startWebcam();
      // Show calibration prompt when streaming starts
      if (!calibrationDone) {
        setShowCalibrationPrompt(true);
      }
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
    const constraints = {
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
        const ctx = canvasRef.current.getContext("2d");
        const height = videoRef.current.videoHeight;
        const width = videoRef.current.videoWidth;
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

  // --- Modified detectFrame to use calibrated filter ---
  const detectFrame = async (forceRedraw = false) => {
    if (!modelWorkerId) {
      return;
    }
    // Only run if video is ready
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || videoRef.current.readyState < 2) {
      if (isStreaming) {
        setTimeout(detectFrame, 100 / 3);
      }
      return;
    }

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
      if (calibrationDone && calibratedFilter && Array.isArray(calibratedFilter.filterChain) && calibratedFilter.filterChain.length > 0) {
        try {
          processedCanvas = applyFilterChainToCanvas(tempCanvas, calibratedFilter.filterChain);
        } catch (error) {
          console.error('Error applying calibrated filters:', error);
          // Fall back to unprocessed canvas
          processedCanvas = tempCanvas;
        }
      }
      
      // Run inference on the processed canvas
      const predictions = await inferenceService.infer(processedCanvas);
      
      // Call the onPredictions callback if provided
      if (onPredictions && typeof onPredictions === 'function') {
        onPredictions(predictions);
      }
      
      // Update preprocessed view if enabled
      if (showPreprocessedView && preprocessedCanvasRef.current) {
        const preprocessedCtx = preprocessedCanvasRef.current.getContext('2d');
        preprocessedCtx.drawImage(processedCanvas, 0, 0, 240, 135);
      }
      
      // Update debug canvas if enabled
      if (showDebugCanvas !== undefined && window.showDebugCanvas) {
        const debugCanvas = document.getElementById('debug-inference-canvas');
        if (debugCanvas) {
          const debugCtx = debugCanvas.getContext('2d');
          debugCtx.drawImage(processedCanvas, 0, 0, 320, 180);
        }
      }
      
    } catch (error) {
      console.error('Error in detectFrame:', error);
    }
    
    // Continue the loop
    if (isStreaming) {
      setTimeout(detectFrame, 100 / 3);
    }
  };

  // Apply filter and preprocess for calibration
  const applyFilterAndPreprocess = (filterOverride = null) => {
    if (!videoRef.current || !preprocessedCanvasRef.current) return;
    
    const ctx = preprocessedCanvasRef.current.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, preprocessedCanvasRef.current.width, preprocessedCanvasRef.current.height);
    
    // Draw the current video frame
    ctx.drawImage(videoRef.current, 0, 0, preprocessedCanvasRef.current.width, preprocessedCanvasRef.current.height);
    
    // Apply the filter chain
    const filterChain = filterOverride || (calibratedFilter && calibratedFilter.filterChain) || [];
    if (filterChain.length > 0) {
      try {
        applyFilterChainToCanvas(preprocessedCanvasRef.current, filterChain);
      } catch (error) {
        console.error('Error applying filters in preprocess:', error);
      }
    }
  };

  // Animation loop for preprocessed view
  useEffect(() => {
    if (!isStreaming || !showPreprocessedView) return;
    
    const interval = setInterval(() => {
      applyFilterAndPreprocess();
    }, 100);
    
    return () => clearInterval(interval);
  }, [isStreaming, showPreprocessedView, calibrationDone, calibratedFilter]);

  // --- Inference Loop Control ---
  useEffect(() => {
    // Run detectFrame if streaming (removed calibration requirement)
    if (isStreaming && modelWorkerId) {
      detectFrame();
    }
    // eslint-disable-next-line
  }, [isStreaming, modelWorkerId]);

  // --- Calibration handler ---
  async function handleCalibration() {
    console.log('Calibration button clicked!');
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
      alert("Please start the video stream first");
      return;
    }

    console.log('Starting calibration...');
    console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
    setCalibrating(true);
    setCalibrationProgress('Taking calibration frame...');
    setNoGuitarDetected(false);
    calibrationCancelledRef.current = false;

    const runInference = async (canvasOrVideo) => {
      try {
        console.log('Running inference on canvas with dimensions:', canvasOrVideo.width, 'x', canvasOrVideo.height);
        const predictions = await inferenceService.infer(canvasOrVideo);
        console.log('Inference results:', predictions);
        return predictions.filter(pred => pred.class !== 'Hand');
      } catch (error) {
        console.error('Inference error during calibration:', error);
        return [];
      }
    };

    const takeCalibrationFrame = () => {
      if (calibrationCancelledRef.current) return;

      // Create a canvas with the current video frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);
      
      console.log('Calibration frame captured, dimensions:', canvas.width, 'x', canvas.height);

      // Run baseline inference (no preprocessing)
      runInference(canvas).then(baselinePredictions => {
        if (calibrationCancelledRef.current) return;

        console.log('Baseline predictions:', baselinePredictions);
        const baselineConfidence = baselinePredictions.length > 0 
          ? baselinePredictions.reduce((sum, pred) => sum + pred.confidence, 0) / baselinePredictions.length 
          : 0;

        console.log('Baseline confidence:', baselineConfidence);

        if (baselineConfidence < 0.3) {
          setNoGuitarDetected(true);
          setCalibrationProgress('No guitar detected. Please ensure guitar is in frame.');
          setCalibrating(false);
          return;
        }

        // Test different filter combinations
        const testFilters = [
          { filter: 'brightness', param: 1.2 },
          { filter: 'contrast', param: 1.3 },
          { filter: 'gamma', param: 0.8 },
          { filter: 'brightness', param: 1.2, filter2: 'contrast', param2: 1.3 },
          { filter: 'gamma', param: 0.8, filter2: 'brightness', param: 1.1 }
        ];

        let bestFilter = null;
        let bestConfidence = baselineConfidence;
        let totalTests = testFilters.length;

        console.log('Starting filter tests, total tests:', totalTests);

        testFilters.forEach((filterConfig, index) => {
          if (calibrationCancelledRef.current) return;

          setTimeout(async () => {
            if (calibrationCancelledRef.current) return;

            console.log(`Testing filter ${index + 1}/${totalTests}:`, filterConfig);
            setCalibrationProgress(`Testing filter ${index + 1}/${totalTests}...`);

            try {
              // Create a copy of the canvas for filtering
              const canvasCopy = document.createElement('canvas');
              const ctxCopy = canvasCopy.getContext('2d');
              canvasCopy.width = canvas.width;
              canvasCopy.height = canvas.height;
              ctxCopy.drawImage(canvas, 0, 0);

              // Apply filter to canvas copy
              const filteredCanvas = applyFilterChainToCanvas(canvasCopy, [filterConfig]);
              console.log('Filter applied successfully');

              // Test inference with filtered canvas
              const filteredPredictions = await runInference(filteredCanvas);
              const filteredConfidence = filteredPredictions.length > 0 
                ? filteredPredictions.reduce((sum, pred) => sum + pred.confidence, 0) / filteredPredictions.length 
                : 0;

              console.log(`Filter ${index + 1} confidence:`, filteredConfidence);

              if (filteredConfidence > bestConfidence) {
                bestConfidence = filteredConfidence;
                bestFilter = [filterConfig];
                console.log('New best filter found:', filterConfig);
              }

              // Check if this is the last test
              if (index === totalTests - 1) {
                if (calibrationCancelledRef.current) return;

                console.log('Calibration complete. Best confidence:', bestConfidence);
                if (bestConfidence >= 0.8) {
                  setCalibrationResult({
                    baseline: baselineConfidence,
                    filterChain: bestFilter,
                    avgConfidence: bestConfidence
                  });
                  setCalibratedFilter({ filterChain: bestFilter });
                  setCalibrationDone(true);
                  setShowCalibrationPrompt(false); // Hide the calibration prompt
                  setCalibrationProgress('Calibration successful!');
                } else {
                  setCalibrationProgress('No filter achieved confidence ≥ 80%. Please try again with better lighting.');
                  setShowCalibrationPrompt(true); // Show the calibration prompt again for retry
                }
                setCalibrating(false);
              }
            } catch (error) {
              console.error(`Error testing filter ${index + 1}:`, error);
              
              // Check if this is the last test even if there was an error
              if (index === totalTests - 1) {
                if (calibrationCancelledRef.current) return;
                
                if (bestConfidence >= 0.8) {
                  setCalibrationResult({
                    baseline: baselineConfidence,
                    filterChain: bestFilter,
                    avgConfidence: bestConfidence
                  });
                  setCalibratedFilter({ filterChain: bestFilter });
                  setCalibrationDone(true);
                  setCalibrationProgress('Calibration successful!');
                } else {
                  setCalibrationProgress('No filter achieved confidence ≥ 80%. Please try again with better lighting.');
                  setShowCalibrationPrompt(true); // Show the calibration prompt again for retry
                }
                setCalibrating(false);
              }
            }
          }, index * 1000); // Stagger tests by 1 second
        });

      }).catch(error => {
        console.error('Calibration error:', error);
        setCalibrationProgress('Calibration failed. Please try again.');
        setCalibrating(false);
      });
    };

    takeCalibrationFrame();
  }

  function handleStopCalibration() {
    calibrationCancelledRef.current = true;
    setCalibrating(false);
    setCalibrationProgress('');
  }

  function handleRetakeFrame() {
    if (calibrationDone || calibrationResult) {
      setShowOverridePrompt(true);
    } else {
      handleCalibration();
    }
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
      handleCalibration();
    }
  }

  return (
    <div className="guitar-canvas">
      <div className="guitar-canvas-content">
        {/* Debug calibration state */}
        {console.log('Calibration state debug:', {
          showCalibration,
          isStreaming,
          showCalibrationPrompt,
          calibrating,
          calibrationDone,
          calibrationResult
        })}
        
        {/* Calibration UI */}
        {showCalibration && isStreaming && showCalibrationPrompt && !calibrating && (
          <div className="calibration-section">
            <div className="calibration-prompt">
              <h3>🎸 Guitar Calibration</h3>
              <p>Please put your guitar in frame before calibrating for optimal detection.</p>
              <button 
                className="start-btn" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Calibration button clicked in JSX');
                  handleCalibration();
                }} 
                disabled={calibrating}
                style={{ pointerEvents: 'auto', zIndex: 1000 }}
              >
                Start Calibration
              </button>
            </div>
          </div>
        )}
        {showCalibration && showOverridePrompt && (
          <div className="calibration-section">
            <div className="calibration-override-prompt">
              <h3>⚠️ Recalibration Warning</h3>
              <p>Are you sure you want to recalibrate? This will override your current settings.</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                <button 
                  className="start-btn" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOverrideConfirm(true);
                  }}
                  style={{ pointerEvents: 'auto', zIndex: 1000 }}
                >
                  Yes, Recalibrate
                </button>
                <button 
                  className="stop-btn" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOverrideConfirm(false);
                  }}
                  style={{ pointerEvents: 'auto', zIndex: 1000 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {showCalibration && isStreaming && calibrating && (
          <div className="calibration-section">
            <div className="calibration-progress">
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
                <button 
                  className="stop-btn" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStopCalibration();
                  }}
                  style={{ pointerEvents: 'auto', zIndex: 1000 }}
                >
                  Stop Calibration
                </button>
                <button 
                  className="start-btn" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRetakeFrame();
                  }}
                  style={{ pointerEvents: 'auto', zIndex: 1000 }}
                >
                  Retake Frame
                </button>
              </div>
              <div className="progress-bar-container">
                <div className="space-progress-bar-bg">
                  <div className="space-progress-bar-fill" style={{ width: `${(calibrationProgress && calibrationProgress.percent) || 0}%` }} />
                </div>
                <div className="progress-text">
                  {typeof calibrationProgress === 'object' && calibrationProgress !== null ? calibrationProgress.text : calibrationProgress}
                </div>
              </div>
              {noGuitarDetected && (
                <div style={{ color: '#f44336', marginTop: 12, fontWeight: 'bold', fontSize: '16px' }}>
                  🚫 NO GUITAR DETECTED
                </div>
              )}
            </div>
          </div>
        )}
        {showCalibration && isStreaming && !calibrating && calibrationResult && calibrationDone && (
          <div className="calibration-section">
            <div className="calibration-result">
              <h3>✅ Calibration Complete</h3>
              <button 
                className="start-btn" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRetakeFrame();
                }} 
                style={{ marginBottom: '16px', pointerEvents: 'auto', zIndex: 1000 }}
              >
                Retake Calibration Frame
              </button>
              <div>
                <p><strong>Baseline (No Preprocessing):</strong> {calibrationResult.baseline ? (calibrationResult.baseline * 100).toFixed(1) + '%' : '--'}</p>
                <p><strong>Best Filter:</strong> {Array.isArray(calibrationResult?.filterChain) ? calibrationResult.filterChain.map(f => `${f.filter} (${f.param})`).join(', ') : '--'}</p>
                <p><strong>Avg Confidence After Preprocessing:</strong> {calibrationResult.avgConfidence ? (calibrationResult.avgConfidence * 100).toFixed(1) + '%' : '--'}</p>
              </div>
            </div>
          </div>
        )}
        {showCalibration && isStreaming && !calibrating && !calibrationDone && calibrationProgress && calibrationProgress.toString().includes('No filter achieved confidence') && (
          <div className="calibration-section">
            <div className="calibration-error">
              <h3>❌ Calibration Failed</h3>
              <p>No filter achieved confidence ≥ 80%.</p>
              <p style={{ color: '#ccc', fontSize: '14px' }}>Please move to a location with better lighting and try again.</p>
              <button 
                className="start-btn" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowOverridePrompt(true);
                }} 
                style={{ marginTop: '16px', pointerEvents: 'auto', zIndex: 1000 }}
              >
                Retry Calibration
              </button>
            </div>
          </div>
        )}
        
        <div className="guitar-video-container">
          {/* Main video/canvas always shown when streaming */}
          {isStreaming ? (
            <>
              <video
                id="video"
                ref={videoRef}
                className="guitar-video"
                playsInline
                muted
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, ...videoStyle }}
              />
              <canvas
                id="canvas"
                ref={canvasRef}
                className="guitar-canvas-element"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none', ...canvasStyle }}
              />
              
              {/* Children components (like AudioPitchDetector) */}
              {children}
              
              {/* Preprocessed PiP overlay */}
              {showPreprocessedView && (
                <div className="preprocessed-overlay">
                  <canvas
                    ref={preprocessedCanvasRef}
                    className="preprocessed-canvas"
                    width={240}
                    height={135}
                  />
                  {/* Show which filter is applied after calibration */}
                  {calibrationDone && calibratedFilter && (
                    <div className="preprocessed-label">
                      {Array.isArray(calibratedFilter?.filterChain) ? calibratedFilter.filterChain.map(f => `${f.filter}(${f.param})`).join(', ') : '--'}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="guitar-video-placeholder">
              <div className="guitar-video-placeholder-text">
                {streamStatus || "Click 'Begin Practice' to start video stream"}
              </div>
            </div>
          )}
        </div>

        {/* Stream and PiP toggle buttons below the video/canvas */}
        <div className="guitar-canvas-controls">
          {!isStreaming ? (
            <button 
              className="start-btn" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Begin Practice button clicked');
                setIsStreaming(true);
              }}
              style={{ pointerEvents: 'auto', zIndex: 1000 }}
            >
              Begin Practice
            </button>
          ) : (
            <button 
              className="stop-btn" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Stop Stream button clicked');
                setIsStreaming(false);
              }}
              style={{ pointerEvents: 'auto', zIndex: 1000 }}
            >
              Stop Stream
            </button>
          )}
          {isStreaming && showPreprocessedView !== undefined && (
            <button 
              className={`toggle-preprocessed-btn ${!showPreprocessedView ? 'hidden' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Toggle preprocessed view clicked');
                setShowPreprocessedView(!showPreprocessedView);
              }}
              style={{ pointerEvents: 'auto', zIndex: 1000 }}
            >
              {showPreprocessedView ? 'Hide' : 'Show'} Preprocessed View
            </button>
          )}
          {isStreaming && showDebugCanvas !== undefined && (
            <button 
              className="toggle-debug-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Toggle debug canvas clicked');
                window.showDebugCanvas = !window.showDebugCanvas;
                const debugCanvas = document.getElementById('debug-inference-canvas');
                if (debugCanvas) {
                  debugCanvas.style.display = window.showDebugCanvas ? 'block' : 'none';
                }
              }}
              style={{ pointerEvents: 'auto', zIndex: 1000 }}
            >
              {window.showDebugCanvas ? 'Hide' : 'Show'} Debug Inference
            </button>
          )}
        </div>

        {/* Debug canvas to show what's being sent to Roboflow */}
        {isStreaming && showDebugCanvas !== undefined && (
          <div className="debug-section" style={{ display: window.showDebugCanvas ? 'block' : 'none' }}>
            <div className="debug-title">
              Debug: Image Being Sent to Roboflow
            </div>
            <canvas
              id="debug-inference-canvas"
              className="debug-canvas"
              width={320}
              height={180}
            />
            <div className="debug-description">
              This shows the preprocessed image with calibrated filters applied
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GuitarCanvas; 