// To display predictions, this app has:
// 1. A video that shows a feed from the user's webcam
// 2. A canvas that appears over the video and shows predictions
// When the page loads, a user is asked to give webcam permission.
// After this happens, the model initializes and starts to make predictions
// On the first prediction, an initialiation step happens in detectFrame()
// to prepare the canvas on which predictions are displayed.

var bounding_box_colors = {};

var user_confidence = 0.6;

// Update the colors in this list to set the bounding box colors
var color_choices = [
  "#C7FC00",
  "#FF00FF",
  "#8622FF",
  "#FE0056",
  "#00FFCE",
  "#FF8000",
  "#00B7EB",
  "#FFFF00",
  "#0E7AFE",
  "#FFABAB",
  "#0000FF",
  "#CCCCCC",
];

var canvas_painted = false;
var canvas = document.getElementById("video_canvas");
var ctx = canvas.getContext("2d");

var model = null;
var video = null;
var inferEngine = null;
var workerId = null;

function detectFrame() {
  // On first run, initialize a canvas
  // On all runs, run inference using a video frame
  // For each video frame, draw bounding boxes on the canvas
  if (!workerId) return requestAnimationFrame(detectFrame);

  inferEngine.infer(workerId, video, {
    scoreThreshold: user_confidence
  }).then(function(predictions) {
    if (!canvas_painted) {
      var video_start = document.getElementById("video1");
      canvas.style.width = video_start.width + "px";
      canvas.style.height = video_start.height + "px";
      canvas.width = video_start.width;
      canvas.height = video_start.height;
      // adjust top to margin position of video

      canvas.top = video_start.top;
      canvas.left = video_start.left;
      canvas.style.top = video_start.top + "px";
      canvas.style.left = video_start.left + "px";
      canvas.style.position = "absolute";
      video_start.style.display = "block";
      canvas.style.display = "absolute";
      canvas_painted = true;

      var loading = document.getElementById("loading");
      loading.style.display = "none";
    }
    requestAnimationFrame(detectFrame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (video) {
      drawBoundingBoxes(predictions, ctx)
    }
  }).catch(function(err) {
    console.error("Error during inference:", err);
    requestAnimationFrame(detectFrame);
  });
}

function drawBoundingBoxes(predictions, ctx) {
  // For each prediction, choose or assign a bounding box color choice,
  // then apply the requisite scaling so bounding boxes appear exactly
  // around a prediction.

  // If you want to do anything with predictions, start from this function.
  // For example, you could display them on the web page, check off items on a list,
  // or store predictions somewhere.

  for (var i = 0; i < predictions.length; i++) {
    var confidence = predictions[i].confidence || predictions[i].score;

    console.log(user_confidence)

    if (confidence < user_confidence) {
      continue
    }

    var className = predictions[i].class || predictions[i].className;
    
    if (className in bounding_box_colors) {
      ctx.strokeStyle = bounding_box_colors[className];
    } else {
      var color =
        color_choices[Math.floor(Math.random() * color_choices.length)];
      ctx.strokeStyle = color;
      // remove color from choices
      color_choices.splice(color_choices.indexOf(color), 1);

      bounding_box_colors[className] = color;
    }

    var prediction = predictions[i];
    var bbox = prediction.bbox || {
      x: prediction.x,
      y: prediction.y,
      width: prediction.width,
      height: prediction.height
    };
    
    var x = bbox.x - bbox.width / 2;
    var y = bbox.y - bbox.height / 2;
    var width = bbox.width;
    var height = bbox.height;

    ctx.rect(x, y, width, height);

    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fill();

    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = "4";
    ctx.strokeRect(x, y, width, height);
    ctx.font = "25px Arial";
    ctx.fillText(className + " " + Math.round(confidence * 100) + "%", x, y - 10);
  }
}

async function webcamInference() {
  // Ask for webcam permissions, then run main application.
  var loading = document.getElementById("loading");
  loading.style.display = "block";

  // Make sure InferenceEngine is available
  if (!window.InferenceEngine) {
    console.error("InferenceEngine is not available yet");
    loading.textContent = "Loading inference engine...";
    // Check again in 500ms
    setTimeout(webcamInference, 500);
    return;
  }

  try {
    // Initialize the InferenceEngine using the global constructor
    inferEngine = new window.InferenceEngine();
    
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(function(stream) {
        video = document.createElement("video");
        video.srcObject = stream;
        video.id = "video1";

        // hide video until the web stream is ready
        video.style.display = "none";
        video.setAttribute("playsinline", "");

        document.getElementById("video_canvas").after(video);

        video.onloadeddata = function() {
          video.play();
        }

        // on full load, set the video height and width
        video.onplay = function() {
          height = video.videoHeight;
          width = video.videoWidth;

          // scale down video by 0.75
          height = height * 0.75;
          width = width * 0.75;

          width = Math.round(width);
          height = Math.round(height);

          video.setAttribute("width", width);
          video.setAttribute("height", height);
          video.style.width = width + "px";
          video.style.height = height + "px";

          canvas.style.width = width + "px";
          canvas.style.height = height + "px";
          canvas.width = width;
          canvas.height = height;

          document.getElementById("video_canvas").style.display = "block";
        };

        ctx.scale(1, 1);

        // Load the Roboflow model using InferenceJS
        const configuration = {
          scoreThreshold: CONFIDENCE_THRESHOLD,
          maxDetections: 50, // Add this to limit number of detections
          iouThreshold: 0.5, // Add this for better NMS (non-max suppression)
        };

        // Make sure model name does not include any version information
        let modelName = MODEL_NAME;
        if (modelName.includes("/")) {
          modelName = modelName.split("/")[0];
        }

        // Try to connect to the model directly
        console.log("Starting worker with model:", modelName, "version:", MODEL_VERSION);
        
        // Use a try-catch to handle any initialization errors
        try {
          inferEngine.startWorker(modelName, MODEL_VERSION, publishable_key, configuration)
            .then(function(id) {
              console.log("Worker started with ID:", id);
              workerId = id;
              // Start inference
              detectFrame();
            })
            .catch(function(err) {
              console.error("Error loading model:", err);
              loading.textContent = "Error loading model: " + err.message;
              
              // Try with an alternate approach - specify the model URL directly if needed
              console.log("Attempting alternate loading method...");
              // This is just a fallback in case direct loading doesn't work
              /*
              inferEngine.startWorkerWithModelURL(
                "https://cdn.roboflow.com/models/" + modelName + "/" + MODEL_VERSION + "/model.json",
                publishable_key,
                configuration
              ).then(function(id) {
                console.log("Worker started with direct URL, ID:", id);
                workerId = id;
                detectFrame();
              }).catch(function(err) {
                console.error("Both loading methods failed:", err);
                loading.textContent = "Could not load model. Please check your model name and version.";
              });
              */
            });
        } catch (e) {
          console.error("Error initializing worker:", e);
          loading.textContent = "Error initializing worker: " + e.message;
        }
      })
      .catch(function(err) {
        console.log("Camera error:", err);
        loading.textContent = "Error accessing camera: " + err.message;
      });
  } catch (error) {
    console.error("Error initializing inference engine:", error);
    loading.textContent = "Error initializing: " + error.message;
  }
}

function changeConfidence () {
  user_confidence = document.getElementById("confidence").value / 100;
}

document.getElementById("confidence").addEventListener("input", changeConfidence);

// Initialize when the page is ready
function init() {
  if (window.inferenceJsReady) {
    webcamInference();
  } else {
    // Wait for the inferenceJsReady event
    window.addEventListener('inferenceJsReady', webcamInference);
  }
}

// Make sure DOM is loaded before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}