from flask import Flask, Response, render_template, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import cv2
import json
import os
import time
import platform
from dotenv import load_dotenv
from fretDetector import FretTracker, FretboardNotes
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
    'avg_roboflow_time': 0,
    'avg_processing_time': 0,
    'avg_drawing_time': 0,
    'avg_encoding_time': 0,
    'cache_hits': 0,
    'cache_misses': 0
}

# Frame caching for Roboflow predictions
frame_cache = {}
cache_max_size = 50  # Maximum number of cached frames

# Request throttling to avoid overwhelming Roboflow API
last_roboflow_call = 0
min_call_interval = 0.1  # Minimum seconds between API calls (10 FPS max)

# Adaptive confidence threshold
current_confidence = 40
confidence_adjustment_rate = 5  # How much to adjust confidence by

# Simple frame hash for caching (more reliable than similarity)
def get_frame_hash(frame):
    """Get a simple hash of the frame for caching."""
    try:
        # Resize to small size and convert to grayscale for consistent hashing
        if len(frame.shape) == 3:
            gray = cv2.cvtColor(cv2.resize(frame, (32, 24)), cv2.COLOR_BGR2GRAY)
        else:
            gray = cv2.resize(frame, (32, 24))
        
        # Create a simple hash from the resized grayscale image
        return hash(gray.tobytes())
    except Exception as e:
        print(f"⚠️  WARNING: Frame hashing failed: {str(e)}")
        # Fallback to original frame hash
        return hash(frame.tobytes())

def get_cached_prediction(frame):
    """Get cached prediction for frame."""
    if not frame_cache:
        return None
    
    frame_hash = get_frame_hash(frame)
    
    if frame_hash in frame_cache:
        performance_stats['cache_hits'] += 1
        print(f"🎯 CACHE HIT: Found cached prediction for frame")
        return frame_cache[frame_hash]
    
    performance_stats['cache_misses'] += 1
    return None

def cache_prediction(frame, prediction):
    """Cache prediction for future use."""
    frame_hash = get_frame_hash(frame)
    
    # Limit cache size
    if len(frame_cache) >= cache_max_size:
        # Remove oldest entry (simple FIFO)
        oldest_key = next(iter(frame_cache))
        del frame_cache[oldest_key]
    
    frame_cache[frame_hash] = prediction
    print(f"💾 CACHED: Stored prediction for frame (cache size: {len(frame_cache)})")

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

# set initial scale
fretboard_notes.set_scale('C', 'major')

# Global variables for MJPEG streaming
webcam = None
streaming_active = False
stream_thread = None

class VideoFrame:
    def __init__(self, image, frame_id=0, frame_timestamp=None):
        self.image = image
        self.frame_id = frame_id

def predict_frets(frame):
    """Use Roboflow to predict frets in the frame."""
    total_start = time.time()
    print(f"🔍 PERFORMANCE: Starting prediction for frame shape {frame.shape}")
    
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
        
        # Step 1: Resize image for faster processing
        resize_start = time.time()
        original_shape = frame.shape
        
        # Resize to smaller dimensions for faster processing
        # You can adjust these dimensions based on your needs
        target_width = 640   # Reduced from 1280
        target_height = 480  # Reduced from 720
        
        # Calculate aspect ratio to maintain proportions
        h, w = frame.shape[:2]
        aspect_ratio = w / h
        target_aspect_ratio = target_width / target_height
        
        if aspect_ratio > target_aspect_ratio:
            # Image is wider, fit to width
            new_width = target_width
            new_height = int(target_width / aspect_ratio)
        else:
            # Image is taller, fit to height
            new_height = target_height
            new_width = int(target_height * aspect_ratio)
        
        # Resize the frame
        resized_frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)
        resize_time = log_performance("Image resizing", resize_start)
        print(f"🔍 PERFORMANCE: Resized from {original_shape} to {resized_frame.shape}")
        
        # Step 2: Image preparation
        prep_start = time.time()
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
            # Encode frame as JPEG with lower quality for faster transfer
            encode_start = time.time()
            _, buffer = cv2.imencode('.jpg', resized_frame, [cv2.IMWRITE_JPEG_QUALITY, 75])  # Reduced from 85
            encode_time = log_performance("Image encoding", encode_start)
            
            tmp_file.write(buffer.tobytes())
            tmp_file_path = tmp_file.name
        
        prep_time = log_performance("Image preparation (resize + encode + save)", prep_start)
        
        try:
            # Step 3: Roboflow prediction (this is likely the bottleneck)
            roboflow_start = time.time()
            print(f"🚀 PERFORMANCE: Sending resized image ({new_width}x{new_height}) to Roboflow model...")
            
            throttle_roboflow_calls()
            
            predictions = model.predict(tmp_file_path, confidence=current_confidence).json()
            
            roboflow_time = log_performance("Roboflow API call", roboflow_start)
            
            print(f"📊 PERFORMANCE: Roboflow returned {len(predictions.get('predictions', []))} predictions")
            
            # Step 4: Process predictions and scale back to original size
            process_start = time.time()
            
            # Convert Roboflow predictions to our format
            detections = []
            for i, prediction in enumerate(predictions.get('predictions', [])):
                print(f"DEBUG: Processing prediction {i}: {prediction.get('class', 'unknown')}")
                
                # For segmentation models, we expect polygon points
                if 'points' in prediction and prediction['points']:
                    points = []
                    for point in prediction['points']:
                        # Scale points back to original image size
                        original_x = int(point['x'] * original_shape[1] / new_width)
                        original_y = int(point['y'] * original_shape[0] / new_height)
                        points.append({
                            'x': original_x,
                            'y': original_y
                        })
                    
                    # Get fret number from class name or use index
                    class_name = prediction.get('class', f'Zone{i+1}')
                    try:
                        if class_name.startswith('Zone'):
                            fret_num = int(class_name[4:])  # Extract number after "Zone"
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
                    print(f"DEBUG: Created detection for {class_name} at ({x_center}, {y_center})")
                else:
                    print(f"DEBUG: Prediction {i} has no points, skipping")
            
            process_time = log_performance("Prediction processing and scaling", process_start)
            print(f"📊 PERFORMANCE: Returning {len(detections)} detections")
            
            # Cache the result for future use
            cache_prediction(frame, detections)
            
            # Update performance stats
            performance_stats['total_requests'] += 1
            performance_stats['avg_roboflow_time'] = (performance_stats['avg_roboflow_time'] * (performance_stats['total_requests'] - 1) + roboflow_time) / performance_stats['total_requests']
            
            total_time = log_performance("Total prediction pipeline", total_start)
            print(f"📈 PERFORMANCE: Breakdown - Cache: {cache_time:.3f}s, Resize: {resize_time:.3f}s, Encode: {encode_time:.3f}s, Roboflow: {roboflow_time:.3f}s, Process: {process_time:.3f}s, Total: {total_time:.3f}s")
            
            adjust_confidence_threshold(len(detections))
            
            return detections
            
        finally:
            # Clean up temporary file
            cleanup_start = time.time()
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
            cleanup_time = log_performance("File cleanup", cleanup_start)
                
    except Exception as e:
        print(f"❌ ERROR: Roboflow prediction failed after {time.time() - total_start:.3f}s")
        print(f"Error in Roboflow prediction: {str(e)}")
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
            'cache_method': 'simple_hash',
            'target_image_size': '640x480',
            'jpeg_quality': 75
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
        'avg_roboflow_time': 0,
        'avg_processing_time': 0,
        'avg_drawing_time': 0,
        'avg_encoding_time': 0,
        'cache_hits': 0,
        'cache_misses': 0
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
        current_confidence = max(20, current_confidence - confidence_adjustment_rate)
        print(f"🔧 ADJUSTING: Lowered confidence to {current_confidence} (no detections)")
    elif detection_count > 5:
        # Too many detections, raise threshold to be more selective
        current_confidence = min(60, current_confidence + confidence_adjustment_rate)
        print(f"🔧 ADJUSTING: Raised confidence to {current_confidence} (too many detections)")
    else:
        # Good number of detections, keep current threshold
        pass

if __name__ == '__main__':
    print(f"Starting server on port {PORT}")
    print("Server ready for WebSocket connections!")
    socketio.run(app, debug=True, host='0.0.0.0', port=PORT)