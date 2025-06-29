from flask import Flask, Response, render_template, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import cv2
import json
import os
import time
import platform
from dotenv import load_dotenv
from fretDetector import FretTracker, FretboardNotes, VideoFrame
import base64
import numpy as np
import threading
from roboflow import Roboflow
from datetime import datetime

# load environment variables
load_dotenv()

# get config from env variables
API_KEY = os.getenv('API_KEY', "PXAqQENZCRpDPtJ8rd4w")
MODEL_ID = os.getenv('MODEL_ID', "guitar-frets-segmenter/1")
PORT = int(os.getenv('FLASK_PORT', 8000))

app = Flask(__name__, static_folder='static', template_folder='templates')
cors = CORS(app, origins=["*"], supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Performance tracking
performance_stats = {
    'total_requests': 0,
    'avg_roboflow_time': 0.0,
    'avg_processing_time': 0.0,
    'avg_drawing_time': 0.0,
    'avg_encoding_time': 0.0,
    'cache_hits': 0,
    'cache_misses': 0,
    'batch_requests': 0,
    'single_requests': 0,
    'total_images_processed': 0
}

# Frame caching for Roboflow predictions with improved strategy
frame_cache = {}
cache_max_size = 100  # Increased cache size for better hit rates
cache_ttl = 300  # Cache entries expire after 5 minutes

# Batch processing for multiple frames
batch_queue = []
batch_size = 4  # Process 4 frames at once
batch_timeout = 0.5  # Maximum time to wait for batch to fill
last_batch_time = 0

# Request throttling to avoid overwhelming Roboflow API
last_roboflow_call = 0
min_call_interval = 0.05  # Reduced to 20 FPS max for better responsiveness

# Adaptive confidence threshold with improved logic
current_confidence = 40
confidence_adjustment_rate = 2  # Smaller adjustments for more stable detection
min_confidence = 20
max_confidence = 80

# Image preprocessing settings
target_width = 512   # Further reduced for faster processing
target_height = 384  # Maintain aspect ratio
jpeg_quality = 70    # Reduced for faster transfer
enable_preprocessing = True

# Global variables for MJPEG streaming
webcam = None
streaming_active = False
stream_thread = None

def log_performance(step_name, start_time):
    """Log performance timing for a specific step."""
    elapsed = time.time() - start_time
    print(f"⏱️  PERFORMANCE: {step_name} took {elapsed:.3f}s")
    return elapsed

# Initialize Roboflow
rf = Roboflow(api_key=API_KEY)

# Try to initialize the model, with fallback options
try:
    # Use the correct workspace and project from the URL
    workspace_name = "code-and-chords"
    project_name = "guitar-frets-segmenter"
    version_num = 1  # Default to version 1, you can change this if needed
    
    project = rf.workspace(workspace_name).project(project_name)
    model = project.version(version_num).model
    print(f"Successfully loaded Roboflow model: {workspace_name}/{project_name}/{version_num}")
except Exception as e:
    print(f"Error loading Roboflow model: {str(e)}")
    print("Falling back to default model or will use empty predictions")
    model = None

# Initialize fret tracking objects
fret_tracker = FretTracker(num_frets=12, stability_threshold=0.3)
fretboard_notes = FretboardNotes()
fretboard_notes.set_scale('C', 'major')

# Enhanced frame hash for better caching
def get_frame_hash(frame):
    """Get an enhanced hash of the frame for caching with better collision resistance."""
    try:
        # Resize to consistent small size and convert to grayscale
        if len(frame.shape) == 3:
            gray = cv2.cvtColor(cv2.resize(frame, (64, 48)), cv2.COLOR_BGR2GRAY)
        else:
            gray = cv2.resize(frame, (64, 48))
        
        # Apply Gaussian blur to reduce noise sensitivity
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        
        # Create hash from blurred image with dhash (difference hash)
        diff = blurred[:-1, :] > blurred[1:, :]
        return hash(diff.tobytes())
    except Exception as e:
        print(f"⚠️  WARNING: Enhanced frame hashing failed: {str(e)}")
        # Fallback to simple hash
        return hash(frame.tobytes())

def get_cached_prediction(frame):
    """Get cached prediction for frame with TTL check."""
    if not frame_cache:
        return None
    
    frame_hash = get_frame_hash(frame)
    current_time = time.time()
    
    if frame_hash in frame_cache:
        cache_entry = frame_cache[frame_hash]
        # Check if cache entry is still valid
        if current_time - cache_entry['timestamp'] < cache_ttl:
            performance_stats['cache_hits'] += 1
            print(f"🎯 CACHE HIT: Found valid cached prediction for frame")
            return cache_entry['prediction']
        else:
            # Remove expired entry
            del frame_cache[frame_hash]
            print(f"⏰ CACHE EXPIRED: Removed expired cache entry")
    
    performance_stats['cache_misses'] += 1
    return None

def cache_prediction(frame, prediction):
    """Cache prediction for future use with timestamp."""
    frame_hash = get_frame_hash(frame)
    current_time = time.time()
    
    # Limit cache size with LRU-like eviction
    if len(frame_cache) >= cache_max_size:
        # Remove oldest entries
        oldest_entries = sorted(frame_cache.items(), key=lambda x: x[1]['timestamp'])[:10]
        for key, _ in oldest_entries:
            del frame_cache[key]
        print(f"🗑️  CACHE CLEANUP: Removed 10 oldest entries")
    
    frame_cache[frame_hash] = {
        'prediction': prediction,
        'timestamp': current_time
    }
    print(f"💾 CACHED: Stored prediction for frame (cache size: {len(frame_cache)})")

def preprocess_image(frame):
    """Optimize image preprocessing for Roboflow."""
    if not enable_preprocessing:
        return frame
    
    # Step 1: Resize for optimal processing
    h, w = frame.shape[:2]
    aspect_ratio = w / h
    target_aspect_ratio = target_width / target_height
    
    if aspect_ratio > target_aspect_ratio:
        new_width = target_width
        new_height = int(target_width / aspect_ratio)
    else:
        new_height = target_height
        new_width = int(target_height * aspect_ratio)
    
    resized_frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)
    
    # Step 2: Apply noise reduction for better detection
    denoised = cv2.fastNlMeansDenoisingColored(resized_frame, None, 10, 10, 7, 21)
    
    # Step 3: Enhance contrast for better fret detection
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    l = clahe.apply(l)
    enhanced = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
    
    return enhanced, (new_width, new_height), (w, h)

def batch_predict_frets(frames):
    """Process multiple frames in a single batch for better efficiency."""
    if not frames:
        return []
    
    total_start = time.time()
    print(f"📦 BATCH PROCESSING: Starting batch prediction for {len(frames)} frames")
    
    try:
        if model is None:
            print("DEBUG: Roboflow model not available, returning empty predictions")
            return [[] for _ in frames]
        
        # Preprocess all frames
        preprocessed_frames = []
        original_shapes = []
        temp_files = []
        
        for i, frame in enumerate(frames):
            # Check cache first for each frame
            cached = get_cached_prediction(frame)
            if cached is not None:
                preprocessed_frames.append(None)  # Mark as cached
                original_shapes.append(frame.shape[:2])
                temp_files.append(None)
                continue
            
            # Preprocess frame
            processed_frame, new_shape, orig_shape = preprocess_image(frame)
            preprocessed_frames.append(processed_frame)
            original_shapes.append(orig_shape)
            
            # Save to temp file
            import tempfile
            import os
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                _, buffer = cv2.imencode('.jpg', processed_frame, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
                tmp_file.write(buffer.tobytes())
                temp_files.append(tmp_file.name)
        
        # Filter out cached frames for batch processing
        uncached_frames = [(i, f) for i, f in enumerate(preprocessed_frames) if f is not None]
        uncached_files = [temp_files[i] for i, _ in uncached_frames]
        
        all_predictions = [[] for _ in frames]
        
        if uncached_files:
            # Batch API call for uncached frames
            throttle_roboflow_calls()
            
            batch_start = time.time()
            batch_predictions = model.predict(uncached_files, confidence=current_confidence).json()
            batch_time = log_performance("Batch Roboflow API call", batch_start)
            
            # Process batch results
            for i, (frame_idx, _) in enumerate(uncached_frames):
                if i < len(batch_predictions.get('predictions', [])):
                    predictions = batch_predictions['predictions'][i]
                    detections = process_predictions(predictions, original_shapes[frame_idx], preprocessed_frames[frame_idx].shape[:2])
                    all_predictions[frame_idx] = detections
                    
                    # Cache the result
                    cache_prediction(frames[frame_idx], detections)
        
        # Fill in cached results
        for i, frame in enumerate(frames):
            if preprocessed_frames[i] is None:  # Was cached
                cached_result = get_cached_prediction(frame)
                if cached_result is not None:
                    all_predictions[i] = cached_result
        
        # Cleanup temp files
        for temp_file in temp_files:
            if temp_file and os.path.exists(temp_file):
                os.unlink(temp_file)
        
        performance_stats['batch_requests'] += 1
        performance_stats['total_images_processed'] += len(frames)
        
        total_time = log_performance("Total batch processing", total_start)
        print(f"📦 BATCH COMPLETE: Processed {len(frames)} frames in {total_time:.3f}s")
        
        return all_predictions
        
    except Exception as e:
        print(f"❌ ERROR: Batch prediction failed: {str(e)}")
        return [[] for _ in frames]

def process_predictions(predictions, original_shape, processed_shape):
    """Process Roboflow predictions and scale back to original size."""
    detections = []
    
    for i, prediction in enumerate(predictions):
        if 'points' in prediction and prediction['points']:
            points = []
            for point in prediction['points']:
                # Scale points back to original image size
                original_x = int(point['x'] * original_shape[1] / processed_shape[1])
                original_y = int(point['y'] * original_shape[0] / processed_shape[0])
                points.append({
                    'x': original_x,
                    'y': original_y
                })
            
            # Get fret number from class name
            class_name = prediction.get('class', f'Zone{i+1}')
            try:
                if class_name.startswith('Zone'):
                    fret_num = int(class_name[4:])
                else:
                    fret_num = i + 1
            except ValueError:
                fret_num = i + 1
            
            # Calculate center from scaled points
            x_coords = [p['x'] for p in points]
            y_coords = [p['y'] for p in points]
            x_center = int(sum(x_coords) / len(x_coords))
            y_center = int(sum(y_coords) / len(y_coords))
            
            detection = {
                'class': class_name,
                'confidence': prediction.get('confidence', 0.8),
                'points': points,
                'x_center': x_center,
                'y_center': y_center,
                'fret_num': fret_num
            }
            detections.append(detection)
    
    return detections

def predict_frets(frame):
    """Use Roboflow to predict frets in the frame with optimized processing."""
    total_start = time.time()
    print(f"🔍 PERFORMANCE: Starting optimized prediction for frame shape {frame.shape}")
    
    try:
        if model is None:
            print("DEBUG: Roboflow model not available, returning empty predictions")
            return []
        
        # Step 0: Check cache first
        cache_start = time.time()
        cached_prediction = get_cached_prediction(frame)
        if cached_prediction is not None:
            cache_time = log_performance("Cache lookup", cache_start)
            print(f"🎯 PERFORMANCE: Using cached prediction (saved {cache_time:.3f}s)")
            return cached_prediction
        
        cache_time = log_performance("Cache lookup (miss)", cache_start)
        print(f"❌ CACHE MISS: No similar frame found, calling Roboflow API")
        
        # Step 1: Optimized image preprocessing
        prep_start = time.time()
        processed_frame, new_shape, original_shape = preprocess_image(frame)
        prep_time = log_performance("Optimized image preprocessing", prep_start)
        print(f"🔍 PERFORMANCE: Preprocessed from {original_shape} to {new_shape}")
        
        # Step 2: Prepare image for API with connection pooling
        api_prep_start = time.time()
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
            # Use optimized encoding parameters
            encode_params = [
                cv2.IMWRITE_JPEG_QUALITY, jpeg_quality,
                cv2.IMWRITE_JPEG_OPTIMIZE, 1,
                cv2.IMWRITE_JPEG_PROGRESSIVE, 1
            ]
            _, buffer = cv2.imencode('.jpg', processed_frame, encode_params)
            tmp_file.write(buffer.tobytes())
            tmp_file_path = tmp_file.name
        
        api_prep_time = log_performance("API preparation", api_prep_start)
        
        try:
            # Step 3: Roboflow prediction with optimized settings and retry logic
            roboflow_start = time.time()
            print(f"🚀 PERFORMANCE: Sending optimized image ({new_shape[0]}x{new_shape[1]}) to Roboflow...")
            
            throttle_roboflow_calls()
            
            # Add retry logic for better reliability
            max_retries = 3
            retry_delay = 0.1
            
            for attempt in range(max_retries):
                try:
                    predictions = model.predict(tmp_file_path, confidence=current_confidence).json()
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"⚠️  Roboflow API attempt {attempt + 1} failed, retrying in {retry_delay}s: {str(e)}")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                    else:
                        raise e
            
            roboflow_time = log_performance("Roboflow API call", roboflow_start)
            print(f"📊 PERFORMANCE: Roboflow returned {len(predictions.get('predictions', []))} predictions")
            
            # Step 4: Process predictions with parallel processing for large batches
            process_start = time.time()
            detections = process_predictions(predictions.get('predictions', []), original_shape, new_shape)
            process_time = log_performance("Prediction processing", process_start)
            
            # Cache the result with compression for memory efficiency
            cache_prediction(frame, detections)
            
            # Update performance stats with exponential moving average
            performance_stats['total_requests'] += 1
            performance_stats['single_requests'] += 1
            performance_stats['total_images_processed'] += 1
            
            # Use exponential moving average for smoother stats
            alpha = 0.1  # Smoothing factor
            performance_stats['avg_roboflow_time'] = (
                alpha * roboflow_time + 
                (1 - alpha) * performance_stats['avg_roboflow_time']
            )
            
            total_time = log_performance("Total optimized prediction", total_start)
            print(f"📈 PERFORMANCE: Optimized breakdown - Cache: {cache_time:.3f}s, Preprocess: {prep_time:.3f}s, API Prep: {api_prep_time:.3f}s, Roboflow: {roboflow_time:.3f}s, Process: {process_time:.3f}s, Total: {total_time:.3f}s")
            
            # Adaptive confidence adjustment based on detection quality
            adjust_confidence_threshold(len(detections))
            
            return detections
            
        finally:
            # Clean up temporary file immediately
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except Exception as e:
        print(f"❌ ERROR: Optimized prediction failed after {time.time() - total_start:.3f}s")
        print(f"Error in optimized prediction: {str(e)}")
        import traceback
        traceback.print_exc()
        return []

def custom_sink(predictions, video_frame, fretboard_notes, fret_tracker):
    """
    Custom sink function that draws segmentation masks for fret detections
    and adds scale notes to the frets.
    """
    total_start = time.time()
    frame = video_frame.image.copy()
    print(f"🎨 PERFORMANCE: Starting custom_sink for frame shape {frame.shape}")

    # Step 1: Handle predictions
    handle_start = time.time()
    if isinstance(predictions, list):
        detections = predictions
        print(f"DEBUG: Received list of {len(detections)} detections")
    elif isinstance(predictions, dict) and "predictions" in predictions:
        detections = predictions["predictions"]
        print(f"DEBUG: Received dict with {len(detections)} detections")
    else:
        print("DEBUG: No predictions provided")
        detections = []
    
    handle_time = log_performance("Prediction handling", handle_start)
    print(f"DEBUG: Processing {len(detections)} detections")

    # Step 2: Update fret tracking
    tracking_start = time.time()
    fret_tracker.update(detections, frame.shape[0])
    tracking_time = log_performance("Fret tracking update", tracking_start)
    print(f"DEBUG: After update - stable frets: {len(fret_tracker.get_stable_frets())}")

    # Step 3: Draw segmentation masks
    drawing_start = time.time()
    print(f"🎨 PERFORMANCE: Starting to draw {len(detections)} detections")
    
    for i, detection in enumerate(detections):
        if "points" in detection and len(detection["points"]) >= 3:
            points = detection["points"]
            print(f"DEBUG: Drawing detection {i} with {len(points)} points")
            
            # Convert points to numpy array for polygon drawing
            polygon_points = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.int32)
            
            # Ensure points are within frame bounds
            polygon_points[:, 0] = np.clip(polygon_points[:, 0], 0, frame.shape[1] - 1)
            polygon_points[:, 1] = np.clip(polygon_points[:, 1], 0, frame.shape[0] - 1)
            
            # Draw filled polygon (segmentation mask) with semi-transparent overlay
            overlay = frame.copy()
            cv2.fillPoly(overlay, [polygon_points], (0, 255, 0))  # Green fill
            cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)  # Blend with original
            
            # Draw polygon outline
            cv2.polylines(frame, [polygon_points], True, (0, 255, 0), 2)
            
            # Draw fret number
            x_center = detection.get('x_center', int(np.mean([pt["x"] for pt in points])))
            y_center = detection.get('y_center', int(np.mean([pt["y"] for pt in points])))
            cv2.putText(frame, f"Fret {detection.get('fret_num', i+1)}", (x_center - 20, y_center - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            print(f"DEBUG: Drew fret {detection.get('fret_num', i+1)} at ({x_center}, {y_center})")
        else:
            print(f"DEBUG: Detection {i} has insufficient points: {len(detection.get('points', []))}")

    drawing_time = log_performance("Segmentation mask drawing", drawing_start)

    # Step 4: Draw scale notes
    notes_start = time.time()
    print("DEBUG: About to call draw_scale_notes")
    draw_scale_notes(frame, fret_tracker, fretboard_notes)
    notes_time = log_performance("Scale notes drawing", notes_start)
    print("DEBUG: Finished draw_scale_notes")

    # Step 5: Draw debug information
    debug_start = time.time()
    detection_text = f"Detected {len(detections)} frets"
    stable_text = f"Stable frets: {len(fret_tracker.get_stable_frets())}"
    cv2.putText(frame, detection_text, (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
    cv2.putText(frame, stable_text, (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
    debug_time = log_performance("Debug text drawing", debug_start)

    total_time = log_performance("Total custom_sink processing", total_start)
    print(f"📈 PERFORMANCE: custom_sink breakdown - Handle: {handle_time:.3f}s, Tracking: {tracking_time:.3f}s, Drawing: {drawing_time:.3f}s, Notes: {notes_time:.3f}s, Debug: {debug_time:.3f}s, Total: {total_time:.3f}s")
    
    print("DEBUG: custom_sink returning processed frame")
    return frame

def draw_scale_notes(frame, fret_tracker, fretboard_notes):
    """Draw dots for scale notes on detected frets."""
    stable_frets = fret_tracker.get_stable_frets()
    
    print(f"DEBUG: draw_scale_notes called")
    print(f"DEBUG: stable_frets count: {len(stable_frets)}")
    print(f"DEBUG: sorted_frets count: {len(fret_tracker.sorted_frets)}")
    
    # Process frets in order
    for x_center, fret_data in fret_tracker.sorted_frets:
        fret_num = fret_data['fret_num']
        print(f"DEBUG: Processing fret {fret_num} at x={x_center}")
        
        if fret_num < 1:
            continue
        
        # Calculate string positions (6th string to 1st string)
        string_positions = fret_tracker.get_string_positions(fret_data)
        print(f"DEBUG: String positions for fret {fret_num}: {string_positions}")
        
        # Draw fret number label at the top
        cv2.putText(frame, f"Fret {fret_num}", 
                   (fret_data['x_center'] - 20, int(string_positions[0]) - 20),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        
        # Draw dots for each string if the note is in the scale
        for string_idx, y_pos in enumerate(string_positions):
            scale_positions = fretboard_notes.get_string_note_positions(string_idx)
            note_name = fretboard_notes.get_note_at_position(string_idx, fret_num)
            
            print(f"DEBUG: String {string_idx}, fret {fret_num}, note {note_name}, in scale: {fret_num in scale_positions}")
            
            if fret_num in scale_positions:
                if note_name == fretboard_notes.selected_root:
                    # Root note - red
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 8, (0, 0, 255), -1)
                    print(f"DEBUG: Drawing RED root note {note_name} at ({fret_data['x_center']}, {int(y_pos)})")
                else:
                    # Scale note - blue
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 8, (255, 0, 0), -1)
                    print(f"DEBUG: Drawing BLUE scale note {note_name} at ({fret_data['x_center']}, {int(y_pos)})")
                
                # Display note name
                text_x = fret_data['x_center'] + 12
                text_y = int(y_pos) + 5
                cv2.putText(frame, note_name, (text_x, text_y),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            else:
                # Non-scale note - small grey dot
                cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 4, (128, 128, 128), -1)
                print(f"DEBUG: Drawing GREY non-scale note {note_name} at ({fret_data['x_center']}, {int(y_pos)})")

    # Draw scale info
    scale_text = f"{fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}"
    cv2.putText(frame, scale_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 
                0.7, (255, 255, 255), 2, cv2.LINE_AA)

def init_webcam():
    """Initialize webcam capture."""
    global webcam
    if webcam is None:
        webcam = cv2.VideoCapture(0)
        if not webcam.isOpened():
            print("Error: Could not open webcam")
            return False
        webcam.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        webcam.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        webcam.set(cv2.CAP_PROP_FPS, 30)
        print("Webcam initialized successfully")
    return True

def release_webcam():
    """Release webcam resources."""
    global webcam
    if webcam is not None:
        webcam.release()
        webcam = None
        print("Webcam released")

def process_frame_with_inference(frame):
    """Process frame using InferencePipeline and custom_sink."""
    total_start = time.time()
    print(f"🔄 PERFORMANCE: Starting complete frame processing for shape {frame.shape}")
    
    try:
        # Step 1: Create VideoFrame object
        video_start = time.time()
        video_frame = VideoFrame(
            image=frame,
            frame_id=0,
            frame_timestamp=datetime.now()
        )
        video_time = log_performance("VideoFrame creation", video_start)
        
        # Step 2: Get predictions from Roboflow
        predict_start = time.time()
        predictions = predict_frets(frame)
        predict_time = log_performance("Roboflow prediction", predict_start)
        
        # Step 3: Process with custom_sink
        sink_start = time.time()
        processed_img = custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
        sink_time = log_performance("Custom sink processing", sink_start)
        
        total_time = log_performance("Total frame processing", total_start)
        print(f"📈 PERFORMANCE: Complete pipeline - Video: {video_time:.3f}s, Predict: {predict_time:.3f}s, Sink: {sink_time:.3f}s, Total: {total_time:.3f}s")
        
        return processed_img
    except Exception as e:
        print(f"❌ ERROR: Frame processing failed after {time.time() - total_start:.3f}s")
        print(f"Error processing frame: {str(e)}")
        return frame

def generate_mjpeg_frames():
    """Generate MJPEG frames for streaming."""
    global webcam, streaming_active
    
    if not init_webcam():
        return
    
    print("Starting MJPEG stream generation")
    frame_count = 0
    
    while streaming_active:
        if webcam is None or not webcam.isOpened():
            print("Webcam not available, stopping stream")
            break
            
        ret, frame = webcam.read()
        if not ret:
            print("Failed to read frame from webcam")
            continue
        
        try:
            # Process frame with inference and note drawing
            processed_frame = process_frame_with_inference(frame)
            
            # Encode frame as JPEG with optimized settings
            encode_params = [
                cv2.IMWRITE_JPEG_QUALITY, 85,
                cv2.IMWRITE_JPEG_OPTIMIZE, 1
            ]
            _, buffer = cv2.imencode('.jpg', processed_frame, encode_params)
            frame_bytes = buffer.tobytes()
            
            # Yield frame in MJPEG format
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n'
                   b'Content-Length: ' + str(len(frame_bytes)).encode() + b'\r\n'
                   b'\r\n' + frame_bytes + b'\r\n')
            
            frame_count += 1
            if frame_count % 30 == 0:  # Log every 30 frames
                print(f"Streamed {frame_count} frames")
            
            # Small delay to control frame rate (30 FPS)
            time.sleep(0.033)
            
        except Exception as e:
            print(f"Error processing frame {frame_count}: {str(e)}")
            continue

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

@app.route('/process_frame', methods=['POST'])
def process_frame():
    """Process a single frame from React frontend and return annotated frame."""
    request_start = time.time()
    print(f"🌐 PERFORMANCE: Starting HTTP frame processing request")
    
    try:
        print("DEBUG: /process_frame endpoint called")
        
        # Step 0: Request parsing
        parse_start = time.time()
        data = request.get_json()
        if not data or 'image' not in data:
            print("DEBUG: No image data provided")
            return jsonify({'error': 'No image data provided'}), 400
        
        # Check if frontend sent timing info
        frontend_send_time = data.get('frontend_send_time', None)
        if frontend_send_time:
            network_time = time.time() - frontend_send_time
            print(f"🌐 PERFORMANCE: Network transfer time: {network_time:.3f}s")
        
        parse_time = log_performance("Request parsing", parse_start)
        print("DEBUG: Image data received, processing...")
        
        # Step 1: Decode image
        decode_start = time.time()
        # Extract base64 image data
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]  # Remove data:image/jpeg;base64,
        
        # Decode base64 to numpy array
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            print("DEBUG: Failed to decode image")
            return jsonify({'error': 'Failed to decode image'}), 400

        decode_time = log_performance("Image decoding", decode_start)
        print(f"DEBUG: Decoded image shape: {img.shape}")

        # Step 2: Process frame
        process_start = time.time()
        # Create VideoFrame object for processing
        video_frame = VideoFrame(
            image=img,
            frame_id=0,
            frame_timestamp=datetime.now()
        )
        
        # Use InferencePipeline to detect frets
        predictions = predict_frets(img)
        
        # Use custom_sink function to draw notes and get processed frame
        print("DEBUG: Calling custom_sink...")
        processed_img = custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
        process_time = log_performance("Frame processing", process_start)
        print(f"DEBUG: custom_sink returned processed image shape: {processed_img.shape}")
        
        # Step 3: Encode response
        encode_start = time.time()
        # Encode processed image to base64
        _, buffer = cv2.imencode('.jpg', processed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        processed_image_b64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
        processed_image_uri = f"data:image/jpeg;base64,{processed_image_b64}"
        encode_time = log_performance("Response encoding", encode_start)
        
        # Step 4: Prepare response
        response_start = time.time()
        response_data = {
            'processed_image': processed_image_uri,
            'status': 'success',
            'performance': {
                'total_time': time.time() - request_start,
                'parse_time': parse_time,
                'decode_time': decode_time,
                'process_time': process_time,
                'encode_time': encode_time,
                'response_prep_time': time.time() - response_start
            }
        }
        
        if frontend_send_time:
            response_data['performance']['network_transfer_time'] = network_time
            response_data['performance']['total_round_trip'] = time.time() - frontend_send_time
        
        total_time = log_performance("Total HTTP request", request_start)
        print(f"📈 PERFORMANCE: HTTP breakdown - Parse: {parse_time:.3f}s, Decode: {decode_time:.3f}s, Process: {process_time:.3f}s, Encode: {encode_time:.3f}s, Total: {total_time:.3f}s")
        
        if frontend_send_time:
            print(f"🌐 PERFORMANCE: Complete round-trip time: {time.time() - frontend_send_time:.3f}s")
        
        print("DEBUG: Sending processed frame back to frontend")
        return jsonify(response_data)
                
    except Exception as e:
        print(f"❌ ERROR: HTTP processing failed after {time.time() - request_start:.3f}s")
        print(f"DEBUG: Error processing frame: {str(e)}")
        return jsonify({'error': str(e)}), 500

@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection."""
    print('Client connected')
    emit('status', {'message': 'Connected to server'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection."""
    print('Client disconnected')

@socketio.on('process_frame_ws')
def handle_frame_processing(data):
    """Handle frame processing via WebSocket."""
    ws_start = time.time()
    print(f"🔌 PERFORMANCE: Starting WebSocket frame processing")
    
    try:
        print("DEBUG: WebSocket process_frame_ws called")
        
        # Step 0: Extract timing info
        frontend_send_time = data.get('frontend_send_time', None)
        if frontend_send_time:
            network_time = time.time() - frontend_send_time
            print(f"🔌 PERFORMANCE: WebSocket network transfer time: {network_time:.3f}s")
        
        # Step 1: Extract and decode image
        decode_start = time.time()
        # Extract base64 image data
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        print("DEBUG: WebSocket - Image data extracted, decoding...")
        # Decode base64 to numpy array
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            print("DEBUG: WebSocket - Failed to decode image")
            emit('frame_processed', {'error': 'Failed to decode image'})
            return

        decode_time = log_performance("WebSocket image decoding", decode_start)
        print(f"DEBUG: WebSocket - Decoded image shape: {img.shape}")

        # Step 2: Process frame
        process_start = time.time()
        # Create VideoFrame object
        video_frame = VideoFrame(
            image=img,
            frame_id=0,
            frame_timestamp=datetime.now()
        )
        
        # Use InferencePipeline to detect frets
        predictions = predict_frets(img)
        
        # Get the processed frame from custom_sink
        print("DEBUG: WebSocket - Calling custom_sink...")
        processed_img = custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
        process_time = log_performance("WebSocket frame processing", process_start)
        print(f"DEBUG: WebSocket - custom_sink returned processed image shape: {processed_img.shape}")
        
        # Step 3: Encode response
        encode_start = time.time()
        # Encode to base64
        _, buffer = cv2.imencode('.jpg', processed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        processed_image_b64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
        processed_image_uri = f"data:image/jpeg;base64,{processed_image_b64}"
        encode_time = log_performance("WebSocket response encoding", encode_start)
        
        # Step 4: Prepare response
        response_start = time.time()
        response_data = {
            'processed_image': processed_image_uri,
            'status': 'success',
            'performance': {
                'total_time': time.time() - ws_start,
                'decode_time': decode_time,
                'process_time': process_time,
                'encode_time': encode_time,
                'response_prep_time': time.time() - response_start
            }
        }
        
        if frontend_send_time:
            response_data['performance']['network_transfer_time'] = network_time
            response_data['performance']['total_round_trip'] = time.time() - frontend_send_time
        
        total_time = log_performance("Total WebSocket request", ws_start)
        print(f"📈 PERFORMANCE: WebSocket breakdown - Decode: {decode_time:.3f}s, Process: {process_time:.3f}s, Encode: {encode_time:.3f}s, Total: {total_time:.3f}s")
        
        if frontend_send_time:
            print(f"🔌 PERFORMANCE: WebSocket complete round-trip time: {time.time() - frontend_send_time:.3f}s")
        
        print("DEBUG: WebSocket - Sending processed frame back via WebSocket")
        # Send back via WebSocket
        emit('frame_processed', response_data)
                
    except Exception as e:
        print(f"❌ ERROR: WebSocket processing failed after {time.time() - ws_start:.3f}s")
        print(f"DEBUG: WebSocket frame processing error: {str(e)}")
        emit('frame_processed', {'error': str(e)})

@socketio.on('change_scale_ws')
def handle_scale_change(data):
    """Handle scale changes via WebSocket."""
    try:
        root = data.get('root')
        scale_type = data.get('scale_type')
        
        if root and scale_type:
            fretboard_notes.set_scale(root, scale_type)
            emit('scale_changed', {
                'status': 'success',
                'message': f'Changed scale to {root} {scale_type}',
                'scale': {
                    'root': root,
                    'type': scale_type,
                    'notes': fretboard_notes.scale_notes
                }
            })
        else:
            emit('scale_changed', {'error': 'Missing root or scale type'})
    except Exception as e:
        emit('scale_changed', {'error': str(e)})

@app.route('/change_scale', methods=['POST'])
def change_scale():
    try:
        data = request.get_json()
        root = data.get('root')
        scale_type = data.get('scale_type')
        
        if not root or not scale_type:
            return jsonify({'error': 'Missing root or scale type'}), 400
            
        # update the scale in the fretboard notes
        fretboard_notes.set_scale(root, scale_type)
        
        return jsonify({'status': 'success', 'message': f'Changed scale to {root} {scale_type}'})
    except Exception as e:
        print(f"Error changing scale: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_frets')
def get_frets():
    try:
        # Get the latest fret data from the tracker
        stable_frets = fret_tracker.get_stable_frets()
        
        # Convert to serializable format
        fret_data = []
        for x_center, fret in stable_frets.items():
            fret_info = {
                'x_center': int(fret['x_center']),
                'y_center': int(fret['y_center']),
                'fret_num': int(fret['fret_num']),
                'confidence': float(fret['confidence'])
            }
            fret_data.append(fret_info)
        
        return jsonify({
            'frets': fret_data,
            'status': 'success'
        })
    except Exception as e:
        print(f"Error in get_frets: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/mjpeg_stream')
def mjpeg_stream():
    """Return MJPEG stream."""
    global streaming_active
    streaming_active = True
    return Response(generate_mjpeg_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start_stream')
def start_stream():
    """Start the MJPEG stream."""
    global streaming_active
    streaming_active = True
    return jsonify({'status': 'success', 'message': 'Stream started'})

@app.route('/stop_stream')
def stop_stream():
    """Stop the MJPEG stream."""
    global streaming_active
    streaming_active = False
    return jsonify({'status': 'success', 'message': 'Stream stopped'})

@app.route('/webcam_capture')
def webcam_capture():
    """Capture image from webcam and return it."""
    try:
        if not init_webcam():
            return jsonify({'error': 'Failed to initialize webcam'}), 500
        
        if webcam is None or not webcam.isOpened():
            return jsonify({'error': 'Webcam not available'}), 500
        
        ret, frame = webcam.read()
        if not ret:
            return jsonify({'error': 'Failed to read frame from webcam'}), 500
        
        # Process frame with inference and note drawing
        processed_frame = process_frame_with_inference(frame)
        
        # Encode frame as JPEG
        _, buffer = cv2.imencode('.jpg', processed_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        frame_bytes = buffer.tobytes()
        
        return Response(frame_bytes, mimetype='image/jpeg')
    except Exception as e:
        print(f"Error in webcam_capture: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/test_roboflow', methods=['POST'])
def test_roboflow():
    """Test endpoint to debug Roboflow predictions."""
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
            
        # Extract base64 image data
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64 to numpy array
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'Failed to decode image'}), 400

        print(f"DEBUG: Testing Roboflow with image shape: {img.shape}")
        
        # Test Roboflow prediction
        if model is None:
            return jsonify({'error': 'Roboflow model not available'}), 500
            
        # Save frame to temporary file for Roboflow
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
            # Encode frame as JPEG
            _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            tmp_file.write(buffer.tobytes())
            tmp_file_path = tmp_file.name
        
        try:
            # Predict using Roboflow with file path
            predictions = model.predict(tmp_file_path, confidence=40).json()
            
            print(f"DEBUG: Raw Roboflow response: {predictions}")
            
            return jsonify({
                'status': 'success',
                'raw_predictions': predictions,
                'prediction_count': len(predictions.get('predictions', [])),
                'model_info': {
                    'workspace': 'code-and-chords',
                    'project': 'guitar-frets-segmenter',
                    'version': 1
                }
            })
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
                
    except Exception as e:
        print(f"DEBUG: Error testing Roboflow: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/performance_stats')
def get_performance_stats():
    """Get current performance statistics."""
    cache_hit_rate = 0
    if performance_stats['cache_hits'] + performance_stats['cache_misses'] > 0:
        cache_hit_rate = performance_stats['cache_hits'] / (performance_stats['cache_hits'] + performance_stats['cache_misses']) * 100
    
    return jsonify({
        'performance_stats': performance_stats,
        'cache_stats': {
            'cache_size': len(frame_cache),
            'cache_hit_rate': f"{cache_hit_rate:.1f}%",
            'cache_hits': performance_stats['cache_hits'],
            'cache_misses': performance_stats['cache_misses']
        },
        'optimization_settings': {
            'current_confidence': current_confidence,
            'min_call_interval': min_call_interval,
            'cache_max_size': cache_max_size,
            'cache_method': 'enhanced_hash',
            'target_image_size': '512x384',
            'jpeg_quality': 70
        },
        'current_time': datetime.now().isoformat(),
        'model_info': {
            'workspace': 'code-and-chords',
            'project': 'guitar-frets-segmenter',
            'version': 1,
            'status': 'loaded' if model is not None else 'not_loaded'
        }
    })

@app.route('/reset_performance_stats')
def reset_performance_stats():
    """Reset performance statistics."""
    global performance_stats
    performance_stats = {
        'total_requests': 0,
        'avg_roboflow_time': 0.0,
        'avg_processing_time': 0.0,
        'avg_drawing_time': 0.0,
        'avg_encoding_time': 0.0,
        'cache_hits': 0,
        'cache_misses': 0,
        'batch_requests': 0,
        'single_requests': 0,
        'total_images_processed': 0
    }
    return jsonify({'status': 'success', 'message': 'Performance stats reset'})

def throttle_roboflow_calls():
    """Throttle Roboflow API calls to avoid rate limiting."""
    global last_roboflow_call
    current_time = time.time()
    
    if current_time - last_roboflow_call < min_call_interval:
        sleep_time = min_call_interval - (current_time - last_roboflow_call)
        print(f"⏱️  THROTTLING: Waiting {sleep_time:.3f}s before next API call")
        time.sleep(sleep_time)
    
    last_roboflow_call = time.time()

def adjust_confidence_threshold(detection_count):
    """Adaptively adjust confidence threshold based on detection results."""
    global current_confidence
    
    if detection_count == 0:
        # No detections, lower threshold to be more sensitive
        current_confidence = max(min_confidence, current_confidence - confidence_adjustment_rate)
        print(f"🔧 ADJUSTING: Lowered confidence to {current_confidence} (no detections)")
    elif detection_count > 5:
        # Too many detections, raise threshold to be more selective
        current_confidence = min(max_confidence, current_confidence + confidence_adjustment_rate)
        print(f"🔧 ADJUSTING: Raised confidence to {current_confidence} (too many detections)")
    else:
        # Good number of detections, keep current threshold
        pass

@app.route('/batch_process_frames', methods=['POST'])
def batch_process_frames():
    """Process multiple frames in a single batch for better efficiency."""
    request_start = time.time()
    print(f"📦 BATCH: Starting batch frame processing request")
    
    try:
        data = request.get_json()
        if not data or 'frames' not in data:
            return jsonify({'error': 'No frames data provided'}), 400
        
        frames_data = data['frames']
        if not isinstance(frames_data, list) or len(frames_data) == 0:
            return jsonify({'error': 'Invalid frames data format'}), 400
        
        print(f"📦 BATCH: Processing {len(frames_data)} frames")
        
        # Decode all frames
        frames = []
        for i, frame_data in enumerate(frames_data):
            try:
                # Extract base64 image data
                image_data = frame_data['image']
                if ',' in image_data:
                    image_data = image_data.split(',')[1]
                
                # Decode base64 to numpy array
                nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img is None:
                    print(f"⚠️  BATCH: Failed to decode frame {i}")
                    continue
                
                frames.append(img)
            except Exception as e:
                print(f"⚠️  BATCH: Error decoding frame {i}: {str(e)}")
                continue
        
        if not frames:
            return jsonify({'error': 'No valid frames decoded'}), 400
        
        # Process frames in batch
        batch_predictions = batch_predict_frets(frames)
        
        # Encode processed frames
        processed_frames = []
        for i, (frame, predictions) in enumerate(zip(frames, batch_predictions)):
            try:
                # Create VideoFrame object
                video_frame = VideoFrame(
                    image=frame,
                    frame_id=i,
                    frame_timestamp=datetime.now()
                )
                
                # Process with custom_sink
                processed_img = custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
                
                # Encode to base64
                _, buffer = cv2.imencode('.jpg', processed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                processed_image_b64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
                processed_image_uri = f"data:image/jpeg;base64,{processed_image_b64}"
                
                processed_frames.append({
                    'frame_id': i,
                    'processed_image': processed_image_uri,
                    'detection_count': len(predictions)
                })
                
            except Exception as e:
                print(f"⚠️  BATCH: Error processing frame {i}: {str(e)}")
                processed_frames.append({
                    'frame_id': i,
                    'error': str(e)
                })
        
        total_time = time.time() - request_start
        print(f"📦 BATCH: Completed processing {len(processed_frames)} frames in {total_time:.3f}s")
        
        return jsonify({
            'processed_frames': processed_frames,
            'status': 'success',
            'performance': {
                'total_time': total_time,
                'frames_processed': len(processed_frames),
                'avg_time_per_frame': total_time / len(processed_frames) if processed_frames else 0
            }
        })
        
    except Exception as e:
        print(f"❌ ERROR: Batch processing failed: {str(e)}")
        return jsonify({'error': str(e)}), 500

@socketio.on('batch_process_frames_ws')
def handle_batch_frame_processing(data):
    """Handle batch frame processing via WebSocket."""
    ws_start = time.time()
    print(f"📦 BATCH WS: Starting WebSocket batch frame processing")
    
    try:
        if not data or 'frames' not in data:
            emit('batch_frames_processed', {'error': 'No frames data provided'})
            return
        
        frames_data = data['frames']
        if not isinstance(frames_data, list) or len(frames_data) == 0:
            emit('batch_frames_processed', {'error': 'Invalid frames data format'})
            return
        
        print(f"📦 BATCH WS: Processing {len(frames_data)} frames")
        
        # Decode all frames
        frames = []
        for i, frame_data in enumerate(frames_data):
            try:
                # Extract base64 image data
                image_data = frame_data['image']
                if ',' in image_data:
                    image_data = image_data.split(',')[1]
                
                # Decode base64 to numpy array
                nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if img is None:
                    print(f"⚠️  BATCH WS: Failed to decode frame {i}")
                    continue
                
                frames.append(img)
            except Exception as e:
                print(f"⚠️  BATCH WS: Error decoding frame {i}: {str(e)}")
                continue
        
        if not frames:
            emit('batch_frames_processed', {'error': 'No valid frames decoded'})
            return
        
        # Process frames in batch
        batch_predictions = batch_predict_frets(frames)
        
        # Encode processed frames
        processed_frames = []
        for i, (frame, predictions) in enumerate(zip(frames, batch_predictions)):
            try:
                # Create VideoFrame object
                video_frame = VideoFrame(
                    image=frame,
                    frame_id=i,
                    frame_timestamp=datetime.now()
                )
                
                # Process with custom_sink
                processed_img = custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
                
                # Encode to base64
                _, buffer = cv2.imencode('.jpg', processed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
                processed_image_b64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
                processed_image_uri = f"data:image/jpeg;base64,{processed_image_b64}"
                
                processed_frames.append({
                    'frame_id': i,
                    'processed_image': processed_image_uri,
                    'detection_count': len(predictions)
                })
                
            except Exception as e:
                print(f"⚠️  BATCH WS: Error processing frame {i}: {str(e)}")
                processed_frames.append({
                    'frame_id': i,
                    'error': str(e)
                })
        
        total_time = time.time() - ws_start
        print(f"📦 BATCH WS: Completed processing {len(processed_frames)} frames in {total_time:.3f}s")
        
        # Send back via WebSocket
        emit('batch_frames_processed', {
            'processed_frames': processed_frames,
            'status': 'success',
            'performance': {
                'total_time': total_time,
                'frames_processed': len(processed_frames),
                'avg_time_per_frame': total_time / len(processed_frames) if processed_frames else 0
            }
        })
        
    except Exception as e:
        print(f"❌ ERROR: WebSocket batch processing failed: {str(e)}")
        emit('batch_frames_processed', {'error': str(e)})

if __name__ == '__main__':
    print(f"Starting server on port {PORT}")
    print("Server ready for WebSocket connections!")
    socketio.run(app, debug=True, host='0.0.0.0', port=PORT)