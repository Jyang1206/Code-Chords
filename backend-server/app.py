from flask import Flask, Response, render_template, jsonify, request
from flask_cors import CORS
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
            
            # Add retry logic for better reliability
            max_retries = 3
            retry_delay = 0.1
            
            for attempt in range(max_retries):
                try:
                    predictions = model.predict(tmp_file_path, confidence=40).json()
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
            
            total_time = log_performance("Total optimized prediction", total_start)
            print(f"📈 PERFORMANCE: Optimized breakdown - Preprocess: {prep_time:.3f}s, API Prep: {api_prep_time:.3f}s, Roboflow: {roboflow_time:.3f}s, Process: {process_time:.3f}s, Total: {total_time:.3f}s")
            
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

def process_and_encode_frame(image_b64, frontend_send_time=None):
    """Decode base64 image, predict, draw, encode back to base64, return result and performance."""
    perf = {}
    start = time.time()
    # Step 1: Decode image
    decode_start = time.time()
    if ',' in image_b64:
        image_b64 = image_b64.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(image_b64), np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None, {'error': 'Failed to decode image'}
    perf['decode_time'] = time.time() - decode_start

    # Step 2: Predict and draw
    process_start = time.time()
    video_frame = VideoFrame(image=img, frame_id=0, frame_timestamp=datetime.now())
    predictions = predict_frets(img)
    processed_img = custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
    perf['process_time'] = time.time() - process_start

    # Step 3: Encode
    encode_start = time.time()
    _, buffer = cv2.imencode('.jpg', processed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    processed_image_b64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
    processed_image_uri = f"data:image/jpeg;base64,{processed_image_b64}"
    perf['encode_time'] = time.time() - encode_start

    perf['total_time'] = time.time() - start
    if frontend_send_time:
        perf['network_transfer_time'] = time.time() - frontend_send_time
        perf['total_round_trip'] = time.time() - frontend_send_time
    return processed_image_uri, perf

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
            # Directly use the logic
            video_frame = VideoFrame(image=frame, frame_id=0, frame_timestamp=datetime.now())
            predictions = predict_frets(frame)
            processed_frame = custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, 85, cv2.IMWRITE_JPEG_OPTIMIZE, 1]
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
        
        # Step 1: Process frame
        process_start = time.time()
        processed_image_uri, perf = process_and_encode_frame(data['image'], frontend_send_time)
        process_time = log_performance("Frame processing", process_start)
        
        # Step 2: Prepare response
        response_start = time.time()
        response_data = {
            'processed_image': processed_image_uri,
            'status': 'success',
            'performance': perf
        }
        
        if frontend_send_time:
            response_data['performance']['network_transfer_time'] = network_time
            response_data['performance']['total_round_trip'] = time.time() - frontend_send_time
        
        total_time = log_performance("Total HTTP request", request_start)
        print(f"📈 PERFORMANCE: HTTP breakdown - Parse: {parse_time:.3f}s, Process: {process_time:.3f}s, Total: {total_time:.3f}s")
        
        if frontend_send_time:
            print(f"🌐 PERFORMANCE: Complete round-trip time: {time.time() - frontend_send_time:.3f}s")
        
        print("DEBUG: Sending processed frame back to frontend")
        return jsonify(response_data)
                
    except Exception as e:
        print(f"❌ ERROR: HTTP processing failed after {time.time() - request_start:.3f}s")
        print(f"DEBUG: Error processing frame: {str(e)}")
        return jsonify({'error': str(e)}), 500

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
        
        video_frame = VideoFrame(image=frame, frame_id=0, frame_timestamp=datetime.now())
        predictions = predict_frets(frame)
        processed_frame = custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
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

if __name__ == '__main__':
    print(f"Starting server on port {PORT}")
    app.run(debug=True, host='0.0.0.0', port=PORT)