// Global variables
let video = null;
let canvas = document.getElementById('video_canvas');
let ctx = canvas.getContext('2d');
let confidenceSlider = document.getElementById('confidence');
let confidenceValue = document.getElementById('confidence-value');
let userConfidence = CONFIDENCE_THRESHOLD;
let inferenceClient = null;
let model = null;
let isRunningInference = false;

// Colors for bounding boxes
const colors = [
  "#C7FC00", "#FF00FF", "#8622FF", "#FE0056", "#00FFCE",
  "#FF8000", "#00B7EB", "#FFFF00", "#0E7AFE", "#FFABAB"
];
const colorMap = {};

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', async function() {
  // Setup the confidence slider
  confidenceSlider.addEventListener('input', updateConfidence);
  updateConfidence();
  
  // Start camera and inference
  await setupCamera();
  await setupInference();
});

// Update the confidence threshold when the slider changes
function updateConfidence() {
  userConfidence = confidenceSlider.value / 100;
  confidenceValue.textContent = confidenceSlider.value + "%";
}

// Setup the webcam
async function setupCamera() {
  const loading = document.getElementById('loading');
  loading.textContent = "Requesting camera access...";
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    });
    
    video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    video.muted = true;
    
    // Wait for video to be ready
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        // Adjust canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        loading.textContent = "Camera ready!";
        resolve();
      };
    });
  } catch (error) {
    console.error("Error accessing webcam:", error);
    loading.textContent = "Error accessing camera: " + error.message;
    throw error;
  }
}

// Setup the inference client
async function setupInference() {
  const loading = document.getElementById('loading');
  loading.textContent = "Loading model...";
  
  try {
    // Initialize the roboflow inference client
    inferenceClient = new window.roboflow.auth({
      publishable_key: API_KEY
    });
    
    // Load the model
    model = await inferenceClient.load({
      model: MODEL_NAME,
      version: MODEL_VERSION
    });
    
    // Configure model parameters
    model.configure({
      threshold: CONFIDENCE_THRESHOLD,
      max_objects: 50,
      overlap: 0.5
    });
    
    loading.textContent = "Model loaded! Starting inference...";
    loading.style.display = "none";
    
    // Start the detection loop
    detectFrame();
  } catch (error) {
    console.error("Error setting up inference:", error);
    loading.textContent = "Error loading model: " + error.message;
  }
}

// Main detection loop
async function detectFrame() {
  if (!video || !model) {
    requestAnimationFrame(detectFrame);
    return;
  }
  
  if (!isRunningInference) {
    isRunningInference = true;
    
    try {
      // Run detection on the current video frame
      const predictions = await model.detect(video);
      
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw the video frame on the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Draw predictions
      drawPredictions(predictions);
    } catch (error) {
      console.error("Error during inference:", error);
    } finally {
      isRunningInference = false;
    }
  }
  
  // Continue the detection loop
  requestAnimationFrame(detectFrame);
}

// Draw bounding boxes and labels for detections
function drawPredictions(predictions) {
  // Filter predictions based on user confidence setting
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
    const boxX = x - width/2;
    const boxY = y - height/2;
    
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
  });
} 