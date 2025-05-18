// Global variables
let video = null;
let canvas = document.getElementById('video_canvas');
let ctx = canvas.getContext('2d');
let confidenceSlider = document.getElementById('confidence');
let confidenceValue = document.getElementById('confidence-value');
let startButton = document.getElementById('start-button');
let userConfidence = CONFIDENCE_THRESHOLD;
let model = null;
let isRunningInference = false;
let cameraActive = false;
let videoStream = null; // Store the camera stream for stopping
let errorCount = 0; // Track consecutive errors
let usingFallbackMethod = false; // Track if we're using the fallback method

// Scale control elements
let rootNoteSelect = document.getElementById('root-note');
let scaleTypeSelect = document.getElementById('scale-type');
let applyScaleButton = document.getElementById('apply-scale');
let fretCountSlider = document.getElementById('fret-count');
let fretCountValue = document.getElementById('fret-count-value');
let takeScreenshotButton = document.getElementById('take-screenshot');

// Fretboard tracking state
let detectedFrets = {};
let stableFrets = {};
const stabilityThreshold = 5; // Number of frames a fret must be detected to be considered stable
const fretTracking = {
  numFrets: 12,
  detections: {},
  stableFrets: {},
  frameCount: 0,
  stabilityThreshold: 0.3
};

// Scale definition lookup tables
const scaleDefinitions = {
  "major": [0, 2, 4, 5, 7, 9, 11],
  "minor": [0, 2, 3, 5, 7, 8, 10],
  "pentatonic": [0, 3, 5, 7, 10],
  "blues": [0, 3, 5, 6, 7, 10],
  "dorian": [0, 2, 3, 5, 7, 9, 10],
  "phrygian": [0, 1, 3, 5, 7, 8, 10],
  "lydian": [0, 2, 4, 6, 7, 9, 11],
  "mixolydian": [0, 2, 4, 5, 7, 9, 10]
};

// Scale information (default to C Major)
const scaleInfo = {
  root: 'C',
  scaleName: 'major',
  scaleNotes: [],
  // Standard guitar tuning E, A, D, G, B, E (from 6th string to 1st)
  stringNotes: ['E', 'A', 'D', 'G', 'B', 'E']
};

// Colors for bounding boxes and visualization
const colors = [
  "#C7FC00", "#FF00FF", "#8622FF", "#FE0056", "#00FFCE",
  "#FF8000", "#00B7EB", "#FFFF00", "#0E7AFE", "#FFABAB"
];
const colorMap = {};

// Global flag to track camera type (front or back)
let isFrontFacing = true;

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Setup the confidence slider
  confidenceSlider.addEventListener('input', updateConfidence);
  updateConfidence();
  
  // Setup the fret count slider
  fretCountSlider.addEventListener('input', updateFretCount);
  updateFretCount();
  
  // Setup the start button
  startButton.addEventListener('click', startCamera);
  
  // Setup the apply scale button
  applyScaleButton.addEventListener('click', applyScale);
  
  // Setup the take screenshot button
  if (takeScreenshotButton) {
    takeScreenshotButton.addEventListener('click', takeScreenshot);
  }
  
  // Initialize scale notes
  updateScaleNotes();
  
  // Initialize the canvas with space background
  initializeCanvas();
});

// Initialize the canvas with space background
function initializeCanvas() {
  // Make sure canvas dimensions are set to something reasonable
  if (canvas.width < 640) canvas.width = 640;
  if (canvas.height < 480) canvas.height = 480;
  
  // Draw the space background
  drawSpaceBackground();
}

// Update the confidence threshold when the slider changes
function updateConfidence() {
  userConfidence = confidenceSlider.value / 100;
  confidenceValue.textContent = confidenceSlider.value + "%";
  
  // Update model configuration if model is loaded
  if (model) {
    model.configure({ threshold: userConfidence });
  }
}

// Update the fret count when the slider changes
function updateFretCount() {
  const fretCount = fretCountSlider.value;
  fretCountValue.textContent = fretCount;
  fretTracking.numFrets = parseInt(fretCount);
}

// Apply the selected scale
function applyScale() {
  const rootNote = rootNoteSelect.value;
  const scaleType = scaleTypeSelect.value;
  
  scaleInfo.root = rootNote;
  scaleInfo.scaleName = scaleType;
  
  updateScaleNotes();
  
  // Show a notification
  const loading = document.getElementById('loading');
  loading.textContent = `Scale changed to ${rootNote} ${scaleType}`;
  loading.style.display = 'block';
  setTimeout(() => {
    loading.style.display = 'none';
  }, 2000);
}

// Update the scale notes based on root and scale type
function updateScaleNotes() {
  const allNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rootIndex = allNotes.indexOf(scaleInfo.root);
  const scalePattern = scaleDefinitions[scaleInfo.scaleName];
  
  // Generate scale notes
  scaleInfo.scaleNotes = scalePattern.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    return allNotes[noteIndex];
  });
  
  console.log(`Scale updated to ${scaleInfo.root} ${scaleInfo.scaleName}:`, scaleInfo.scaleNotes);
}

// Take a screenshot of the current canvas state
function takeScreenshot() {
  try {
    const dataUrl = canvas.toDataURL('image/png');
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `guitarstory_${scaleInfo.root}_${scaleInfo.scaleName}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show a notification
    const loading = document.getElementById('loading');
    loading.textContent = 'Screenshot saved!';
    loading.style.display = 'block';
    setTimeout(() => {
      loading.style.display = 'none';
    }, 2000);
  } catch (error) {
    console.error('Error taking screenshot:', error);
    
    const loading = document.getElementById('loading');
    loading.textContent = 'Error taking screenshot!';
    loading.style.display = 'block';
    setTimeout(() => {
      loading.style.display = 'none';
    }, 2000);
  }
}

// Start the camera when the start button is clicked
function startCamera() {
  if (cameraActive) {
    // Stop the camera if it's already active
    stopCamera();
    return;
  }
  
  const loading = document.getElementById('loading');
  loading.textContent = "Starting camera...";
  startButton.disabled = true;
  
  // Show settings once camera starts
  document.getElementById('settings').style.display = 'block';
  
  // Initialize the camera
  setupCamera();
}

// Stop the camera and release resources
function stopCamera() {
  if (!cameraActive) return;
  
  const loading = document.getElementById('loading');
  loading.textContent = "Stopping camera...";
  
  // Stop all video tracks
  if (videoStream) {
    videoStream.getTracks().forEach(track => {
      track.stop();
    });
    videoStream = null;
  }
  
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Update UI
  cameraActive = false;
  startButton.textContent = "Start Camera";
  startButton.disabled = false;
  
  // Add a space-themed background to canvas
  drawSpaceBackground();
  
  loading.textContent = "Camera stopped";
  setTimeout(() => {
    loading.style.display = 'none';
  }, 2000);
}

// Draw a space-themed background on the canvas
function drawSpaceBackground() {
  // Create a gradient for space background
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#0B0B3B"); // Deep space blue
  gradient.addColorStop(1, "#380B61"); // Purple space
  
  // Fill background
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw stars
  ctx.fillStyle = "white";
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = Math.random() * 2;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw some larger stars with glow
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const size = 1 + Math.random() * 2;
    
    // Outer glow
    ctx.beginPath();
    const glow = ctx.createRadialGradient(x, y, size, x, y, size * 4);
    glow.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.arc(x, y, size * 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Star
    ctx.beginPath();
    ctx.fillStyle = "white";
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Add application title
  ctx.font = "30px 'Arial'";
  ctx.fillStyle = "#C7FC00";
  ctx.textAlign = "center";
  ctx.fillText("GuitarStory", canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "18px 'Arial'";
  ctx.fillStyle = "#00FFCE";
  ctx.fillText("Click Start Camera to begin your guitar journey", canvas.width / 2, canvas.height / 2 + 20);
  
  // Reset text alignment
  ctx.textAlign = "start";
}

// Setup the webcam
function setupCamera() {
  const loading = document.getElementById('loading');
  loading.textContent = "Requesting camera access...";
  
  // Use more precise facingMode setting with fallbacks
  const constraints = { 
    video: { 
      facingMode: "user", // This is front-facing, more reliable than "environment"
      width: { ideal: 1280 },
      height: { ideal: 720 }
    } 
  };
  
  navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      videoStream = stream; // Store stream for stopping later
      
      // Check if we're using the front camera
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        // Some browsers support 'facingMode' in settings
        if (settings.facingMode) {
          isFrontFacing = settings.facingMode === 'user';
        } else {
          // Assume front camera if we can't determine
          isFrontFacing = true;
        }
        console.log("Camera facing:", isFrontFacing ? "front" : "back");
      }
      
      video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', '');
      video.muted = true;
      
      video.onloadedmetadata = function() {
        video.play();
        // Adjust canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        loading.textContent = "Camera ready! Loading model...";
        
        // Now that video is set up, initialize the model
        setupModel();
        cameraActive = true;
        
        // Change button text
        startButton.textContent = "Stop Camera";
        startButton.disabled = false;
      };
    })
    .catch(function(error) {
      console.error("Error accessing webcam:", error);
      loading.textContent = "Error accessing camera: " + error.message;
      startButton.disabled = false;
    });
}

// Setup the Roboflow model
function setupModel() {
  const loading = document.getElementById('loading');
  loading.textContent = "Loading model...";
  
  // Try multiple loading approaches
  loadModelWithRetry()
    .then(loadedModel => {
      model = loadedModel;
      loading.textContent = "Model loaded! Starting detection...";
      loading.style.display = "none";
      
      // Start detection loop
      detectFrame();
    })
    .catch(error => {
      console.error("All model loading approaches failed:", error);
      loading.textContent = "Error loading model. Please try reloading the page.";
      startButton.disabled = false;
    });
}

// Try multiple approaches to load the model with retry logic
async function loadModelWithRetry(retryCount = 0) {
  const loading = document.getElementById('loading');
  const maxRetries = 3;
  
  try {
    // First attempt: standard loading
    if (retryCount === 0) {
      loading.textContent = "Loading model (approach 1/3)...";
      return await loadModelStandard();
    } 
    // Second attempt: with different format options
    else if (retryCount === 1) {
      loading.textContent = "Trying alternative loading method (2/3)...";
      return await loadModelAlternative();
    } 
    // Third attempt: with minimal configuration
    else {
      loading.textContent = "Trying simplified loading method (3/3)...";
      return await loadModelMinimal();
    }
  } catch (error) {
    console.warn(`Model loading attempt ${retryCount + 1} failed:`, error);
    
    // If we haven't exhausted retries, try next approach
    if (retryCount < maxRetries - 1) {
      return loadModelWithRetry(retryCount + 1);
    }
    
    // All approaches failed
    throw new Error(`Failed to load model after ${maxRetries} attempts: ${error.message}`);
  }
}

// Standard model loading approach
async function loadModelStandard() {
  return new Promise((resolve, reject) => {
    roboflow
      .auth({
        publishable_key: API_KEY,
      })
      .load({
        model: MODEL_NAME,
        version: MODEL_VERSION,
        // No format specification - use defaults
      })
      .then(model => {
        // Configure model with minimal settings
        model.configure({
          threshold: userConfidence
        });
        resolve(model);
      })
      .catch(reject);
  });
}

// Alternative model loading approach
async function loadModelAlternative() {
  return new Promise((resolve, reject) => {
    roboflow
      .auth({
        publishable_key: API_KEY,
      })
      .load({
        model: MODEL_NAME,
        version: MODEL_VERSION,
        // Try without specifying format
        options: {
          imageSize: 320, // Try a different size
          tinyYolo: true  // Try tiny YOLO variant
        }
      })
      .then(model => {
        // Configure model
        model.configure({
          threshold: userConfidence,
          max_objects: 5,
          overlap: 0.6,
          input_size: 320
        });
        resolve(model);
      })
      .catch(reject);
  });
}

// Minimal model loading approach
async function loadModelMinimal() {
  return new Promise((resolve, reject) => {
    roboflow
      .auth({
        publishable_key: API_KEY,
      })
      .load({
        model: MODEL_NAME,
        version: MODEL_VERSION
        // No extra options - use defaults
      })
      .then(model => {
        // Minimal configuration
        model.configure({
          threshold: userConfidence
        });
        resolve(model);
      })
      .catch(reject);
  });
}

// Try a completely different approach for inference
function switchToFallbackMethod() {
  const loading = document.getElementById('loading');
  loading.textContent = "Switching to alternative detection method...";
  loading.style.display = 'block';
  
  // Set flag to use fallback method
  usingFallbackMethod = true;
  
  // Continue with modified approach
  setTimeout(() => {
    loading.style.display = 'none';
  }, 2000);
}

// Main detection loop
function detectFrame() {
  if (!video || !model) {
    requestAnimationFrame(detectFrame);
    return;
  }
  
  if (!isRunningInference && cameraActive) {
    isRunningInference = true;
    fretTracking.frameCount++;
    
    try {
      // COMPLETELY DIFFERENT APPROACH:
      // Instead of using the model's detect directly on video or canvas,
      // we'll take a snapshot, convert it to a blob, and use that for detection
      
      // 1. Create a snapshot canvas
      const snapCanvas = document.createElement('canvas');
      const snapCtx = snapCanvas.getContext('2d');
      
      // Set to standard dimensions that won't cause tensor errors
      snapCanvas.width = 416;
      snapCanvas.height = 416;
      
      // 2. Draw the video frame to the snapshot canvas
      // Calculate aspect ratio-preserving dimensions
      const videoRatio = video.videoWidth / video.videoHeight;
      let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
      
      if (videoRatio > 1) {
        // Video is wider than tall
        drawHeight = snapCanvas.height;
        drawWidth = drawHeight * videoRatio;
        offsetX = (snapCanvas.width - drawWidth) / 2;
      } else {
        // Video is taller than wide
        drawWidth = snapCanvas.width;
        drawHeight = drawWidth / videoRatio;
        offsetY = (snapCanvas.height - drawHeight) / 2;
      }
      
      // Clear the snapshot canvas
      snapCtx.fillStyle = 'black';
      snapCtx.fillRect(0, 0, snapCanvas.width, snapCanvas.height);
      
      // Draw the video onto the snapshot canvas
      snapCtx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
      
      // 3. Convert canvas to blob
      snapCanvas.toBlob(function(blob) {
        // 4. Use the blob for detection
        model.detect(blob)
          .then(function(predictions) {
            // Clear the main canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw the video frame onto the main canvas
            // Properly mirror the video horizontally for selfie view
            ctx.save();
            if (isFrontFacing) {
              // Flip horizontally if using front camera
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            
            // Process predictions
            if (predictions && predictions.length > 0) {
              processFretboardDetections(predictions);
              drawPredictions(predictions);
            }
            
            isRunningInference = false;
          })
          .catch(function(error) {
            console.error("Error during inference:", error);
            
            // Still draw the video
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw with proper mirroring
            ctx.save();
            if (isFrontFacing) {
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            
            isRunningInference = false;
          });
      }, 'image/jpeg', 0.85); // Medium-high quality JPEG
    } catch (error) {
      console.error("Error in detection process:", error);
      isRunningInference = false;
    }
  }
  
  // Continue detection loop
  requestAnimationFrame(detectFrame);
}

// Process detections to track fretboard positions
function processFretboardDetections(predictions) {
  // Filter predictions based on user confidence
  const filteredPredictions = predictions.filter(pred => 
    pred.confidence >= userConfidence
  );
  
  // Reset current frame detections
  const currentDetections = {};
  
  // Process detections - extract fret information
  filteredPredictions.forEach(prediction => {
    const className = prediction.class;
    const confidence = prediction.confidence;
    
    // Example: If class name format is "Fret-3" or similar
    if (className.startsWith("Zone") || className.startsWith("Fret")) {
      const fretMatch = className.match(/(\d+)/);
      if (fretMatch) {
        const fretNum = parseInt(fretMatch[1], 10);
        const { x, y, width, height } = prediction.bbox;
        
        currentDetections[fretNum] = {
          x_center: x,
          y_min: y - height/2,
          y_max: y + height/2,
          confidence: confidence,
          framesSeen: 1
        };
      }
    }
  });
  
  // Update tracking information
  Object.keys(currentDetections).forEach(fretNum => {
    const fret = currentDetections[fretNum];
    if (fretTracking.detections[fretNum]) {
      // Update existing detection
      fretTracking.detections[fretNum].framesSeen += 1;
      fretTracking.detections[fretNum].x_center = 
        (fretTracking.detections[fretNum].x_center * 0.7) + (fret.x_center * 0.3); // Smoothing
      fretTracking.detections[fretNum].y_min = 
        (fretTracking.detections[fretNum].y_min * 0.7) + (fret.y_min * 0.3);
      fretTracking.detections[fretNum].y_max = 
        (fretTracking.detections[fretNum].y_max * 0.7) + (fret.y_max * 0.3);
        
      // Check for stability
      if (fretTracking.detections[fretNum].framesSeen >= stabilityThreshold) {
        fretTracking.stableFrets[fretNum] = {...fretTracking.detections[fretNum]};
      }
    } else {
      // New detection
      fretTracking.detections[fretNum] = {...fret};
    }
  });
  
  // Decay detections that weren't seen in this frame
  Object.keys(fretTracking.detections).forEach(fretNum => {
    if (!currentDetections[fretNum]) {
      fretTracking.detections[fretNum].framesSeen -= 0.5;
      
      // Remove if below threshold
      if (fretTracking.detections[fretNum].framesSeen <= 0) {
        delete fretTracking.detections[fretNum];
        delete fretTracking.stableFrets[fretNum];
      }
    }
  });
}

// Get note at a specific position on the fretboard
function getNoteAtPosition(stringIndex, fretNum) {
  // Standard tuning notes (E, A, D, G, B, E) for strings 6 through 1
  const openStringNotes = scaleInfo.stringNotes;
  const allNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Get open string note for this string (convert stringIndex to 0-5)
  const openNote = openStringNotes[5 - stringIndex]; // Convert from 0-5 to 6-1 string numbering
  
  // Find position of open note in allNotes
  let openNoteIndex = allNotes.indexOf(openNote);
  
  // Calculate the note at the given fret
  let noteIndex = (openNoteIndex + fretNum) % 12;
  return allNotes[noteIndex];
}

// Check if a note is in the current scale
function isNoteInScale(note) {
  return scaleInfo.scaleNotes.includes(note);
}

// Draw bounding boxes and labels for detections
function drawPredictions(predictions) {
  // Apply mirroring transformation if needed
  const flipTransform = isFrontFacing;
  
  // Filter predictions based on user confidence if needed
  const filteredPredictions = predictions.filter(pred => 
    pred.confidence >= userConfidence
  );
  
  // Draw each prediction
  filteredPredictions.forEach(prediction => {
    const { x, y, width, height } = prediction.bbox;
    const className = prediction.class;
    const confidence = prediction.confidence;
    
    // Get or assign a color for this class
    if (!colorMap[className]) {
      colorMap[className] = colors[Object.keys(colorMap).length % colors.length];
    }
    const color = colorMap[className];
    
    // Calculate box coordinates
    let boxX = x - width/2;
    let boxY = y - height/2;
    
    // Adjust coordinates for flipped display if using front camera
    if (flipTransform) {
      boxX = canvas.width - boxX - width;
    }
    
    // Save context state
    ctx.save();
    
    // Draw the bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(boxX, boxY, width, height);
    
    // Draw the label
    ctx.fillStyle = color;
    ctx.font = '18px Arial';
    const label = `${className}: ${Math.round(confidence * 100)}%`;
    const textWidth = ctx.measureText(label).width;
    
    // Draw label background
    ctx.fillRect(boxX, boxY - 25, textWidth + 10, 25);
    
    // Draw label text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, boxX + 5, boxY - 7);
    
    // Restore context state
    ctx.restore();
  });
  
  // Draw fretboard visualization if we have stable frets
  drawFretboardVisualization();
}

// Draw fretboard visualization
function drawFretboardVisualization() {
  const stableFrets = fretTracking.stableFrets;
  
  // Only proceed if we have actual fret detections
  if (Object.keys(stableFrets).length >= 2) {
    // Determine the fretboard area from stable frets
    let fretPositions = [];
    let minY = canvas.height;
    let maxY = 0;
    
    // Collect fret positions and determine vertical bounds
    Object.entries(stableFrets).forEach(([fretNum, fretData]) => {
      fretPositions.push({
        x: fretData.x_center,
        fretNum: parseInt(fretNum, 10)
      });
      minY = Math.min(minY, fretData.y_min);
      maxY = Math.max(maxY, fretData.y_max);
    });
    
    // Sort frets by position
    fretPositions.sort((a, b) => a.x - b.x);
    
    // Only proceed if we have at least 2 frets detected
    if (fretPositions.length >= 2) {
      // Calculate string positions
      const stringMargin = Math.max(0, minY - 20);
      const stringHeight = (maxY - minY) / 5;  // For 6 strings
      
      // Draw strings only between detected frets
      const leftX = fretPositions[0].x - 20;
      const rightX = fretPositions[fretPositions.length - 1].x + 20;
      
      // Draw strings
      for (let i = 0; i < 6; i++) {  // 6 strings
        const stringY = Math.floor(stringMargin + i * stringHeight);
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftX, stringY);
        ctx.lineTo(rightX, stringY);
        ctx.stroke();
        
        // Label string number
        const stringNum = 6 - i;  // Convert to standard numbering
        ctx.fillStyle = '#3498db';
        ctx.font = '16px Arial';
        ctx.fillText(`${stringNum}`, leftX - 20, stringY + 5);
      }
      
      // Draw fret numbers and highlight scale notes
      fretPositions.forEach(({x, fretNum}) => {
        // Draw fret number at top
        ctx.fillStyle = '#27ae60';
        ctx.font = '16px Arial';
        ctx.fillText(`${fretNum}`, x - 5, stringMargin - 10);
        
        // Highlight scale notes on each string
        for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
          const stringY = Math.floor(stringMargin + stringIdx * stringHeight);
          
          // Get note at this position
          const note = getNoteAtPosition(stringIdx, fretNum);
          
          // Check if note is in current scale
          if (isNoteInScale(note)) {
            // Draw scale note circle
            if (note === scaleInfo.root) {
              // Root note - yellow
              ctx.fillStyle = 'rgba(241, 196, 15, 0.7)';
            } else {
              // Other scale note - blue
              ctx.fillStyle = 'rgba(52, 152, 219, 0.7)';
            }
            
            ctx.beginPath();
            ctx.arc(x, stringY, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Add note name
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(note, x, stringY);
            
            // Reset text alignment
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
          }
        }
      });
      
      // Add scale info at bottom
      const scaleText = `${scaleInfo.root} ${scaleInfo.scaleName}`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      const textWidth = ctx.measureText(scaleText).width + 20;
      ctx.fillRect(10, canvas.height - 30, textWidth, 25);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Arial';
      ctx.fillText(scaleText, 20, canvas.height - 12);
    }
  }
} 