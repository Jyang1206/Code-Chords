// Global variables
let video = document.getElementById('webcam');
let captureCanvas = document.getElementById('capture-canvas');
let captureButton = document.getElementById('capture-button');
let backButton = document.getElementById('back-button');
let resultContainer = document.querySelector('.result-container');
let captureContainer = document.querySelector('.capture-container');
let confidenceSlider = document.getElementById('confidence');
let confidenceValue = document.getElementById('confidence-value');
let confidenceThreshold = CONFIDENCE_THRESHOLD;
let ctx = captureCanvas.getContext('2d');
let mediaStream = null;

// Initialize the application
$(document).ready(function() {
    // Initialize webcam
    initializeWebcam();
    
    // Set up event listeners
    captureButton.addEventListener('click', captureAndAnalyze);
    backButton.addEventListener('click', showCamera);
    confidenceSlider.addEventListener('input', updateConfidence);
    
    // Set initial confidence value
    confidenceValue.textContent = (confidenceSlider.value) + "%";
});

function updateConfidence() {
    let value = confidenceSlider.value;
    confidenceValue.textContent = value + "%";
    confidenceThreshold = value / 100;
}

function initializeWebcam() {
    // Request access to the webcam
    let loading = document.getElementById('loading');
    loading.textContent = "Requesting camera access...";
    
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
            mediaStream = stream;
            video.srcObject = stream;
            video.play();
            
            // Show the video feed on the canvas
            video.addEventListener('loadeddata', function() {
                // Set canvas dimensions to match video
                captureCanvas.width = video.videoWidth;
                captureCanvas.height = video.videoHeight;
                
                // Start drawing video to canvas
                drawVideoToCanvas();
                
                // Hide loading message
                loading.style.display = 'none';
            });
        })
        .catch(function(err) {
            console.error("Error accessing webcam:", err);
            loading.textContent = "Error accessing camera: " + err.message;
        });
}

function drawVideoToCanvas() {
    // Draw the current video frame to the canvas
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    }
    
    // Continue drawing frames
    requestAnimationFrame(drawVideoToCanvas);
}

function captureAndAnalyze() {
    // Capture the current frame from canvas
    let imageData = captureCanvas.toDataURL('image/jpeg');
    
    // Show loading message
    let loading = document.getElementById('loading');
    loading.style.display = 'block';
    loading.textContent = "Analyzing image...";
    
    // Send to Roboflow API
    analyzeImage(imageData);
}

function analyzeImage(imageData) {
    // Construct API URL
    let apiUrl = `https://detect.roboflow.com/${MODEL_NAME}/${MODEL_VERSION}`;
    
    // Prepare request parameters
    let params = {
        api_key: API_KEY,
        confidence: confidenceThreshold,
        format: 'image' // Get back an annotated image
    };
    
    // Append parameters to URL
    let url = apiUrl + '?' + $.param(params);
    
    // Make POST request with image data
    $.ajax({
        url: url,
        type: 'POST',
        data: imageData,
        processData: false, // Don't process the data
        contentType: false, // Let jQuery set the content type
        xhr: function() {
            // Create XHR to handle binary response
            var xhr = new XMLHttpRequest();
            xhr.responseType = 'arraybuffer';
            return xhr;
        },
        success: function(response) {
            displayResults(response);
            document.getElementById('loading').style.display = 'none';
        },
        error: function(xhr, status, error) {
            console.error("API error:", error);
            document.getElementById('loading').textContent = "Error analyzing image: " + error;
        }
    });
}

function displayResults(arrayBuffer) {
    // Convert array buffer to blob and create URL
    let arrayBufferView = new Uint8Array(arrayBuffer);
    let blob = new Blob([arrayBufferView], { type: 'image/jpeg' });
    let imageUrl = URL.createObjectURL(blob);
    
    // Display the image
    let resultImage = document.getElementById('result-image');
    resultImage.src = imageUrl;
    
    // Show results container and hide capture container
    captureContainer.style.display = 'none';
    resultContainer.style.display = 'block';
}

function showCamera() {
    // Hide results and show camera again
    resultContainer.style.display = 'none';
    captureContainer.style.display = 'block';
}

// Clean up when page is closed
window.addEventListener('beforeunload', function() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
}); 