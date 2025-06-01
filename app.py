from flask import Flask, Response, render_template, jsonify
from flask_cors import CORS
import cv2
import json
import os
from dotenv import load_dotenv
from fretDetector import FretTracker, FretboardNotes
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
import numpy as np

# Load environment variables
load_dotenv()

# Get configuration from environment variables with defaults
API_KEY = os.getenv('API_KEY', "PXAqQENZCRpDPtJ8rd4w")
MODEL_ID = os.getenv('MODEL_ID', "guitar-frets-segmenter/1")
PORT = int(os.getenv('FLASK_PORT', 8000))

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Initialize video capture
camera = None
# Initialize fret tracking objects
fret_tracker = FretTracker(num_frets=12, stability_threshold=0.3)
fretboard_notes = FretboardNotes()
pipeline = None
frame_buffer = None

def custom_sink(predictions: dict, video_frame: VideoFrame):
    """Custom sink function for the inference pipeline."""
    global frame_buffer
    try:
        frame = video_frame.image.copy()
        
        # Update fret tracking with new detections
        fret_tracker.update(predictions.get("predictions", []), frame.shape[0])
        
        # Draw scale notes
        draw_scale_notes(frame, fret_tracker, fretboard_notes)
        
        # Store the processed frame in the buffer
        frame_buffer = frame
        
        # Return 0 to continue processing
        return 0
    except Exception as e:
        print(f"Error in custom_sink: {str(e)}")
        return 0  # Continue processing even if we have an error

def get_camera():
    global camera
    if camera is None:
        camera = cv2.VideoCapture(0)
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    return camera

def release_camera():
    global camera, pipeline
    if camera is not None:
        camera.release()
        camera = None
    if pipeline is not None:
        pipeline.stop()

def initialize_pipeline():
    global pipeline
    if pipeline is None:
        try:
            pipeline = InferencePipeline.init(
                model_id=MODEL_ID,
                api_key=API_KEY,
                video_reference=0,
                on_prediction=custom_sink
            )
            pipeline.start()
            return True
        except Exception as e:
            print(f"Error initializing pipeline: {str(e)}")
            return False
    return True

def process_frame(frame):
    try:
        # Create a VideoFrame object
        video_frame = VideoFrame(frame)
        
        # Run inference
        predictions = pipeline.model.infer(video_frame.image)
        
        # Get stable frets
        stable_frets = fret_tracker.get_stable_frets()
        
        # Convert fret data to serializable format
        fret_data = []
        for x_center, fret in stable_frets.items():
            fret_info = {
                'x_center': int(fret['x_center']),
                'y_center': int(fret['y_center']),
                'fret_num': int(fret['fret_num']),
                'confidence': float(fret['confidence'])
            }
            fret_data.append(fret_info)
        
        return fret_data
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
        return []

def draw_scale_notes(frame, fret_tracker, fretboard_notes):
    """Draw dots for scale notes on detected frets."""
    try:
        stable_frets = fret_tracker.get_stable_frets()
        
        # Process frets in order
        for x_center, fret_data in fret_tracker.sorted_frets:
            fret_num = fret_data['fret_num']
            if fret_num < 1:
                continue
            
            # Draw fret number
            cv2.putText(frame, f"Fret {fret_num}", 
                       (fret_data['x_center'] - 20, fret_data['y_min'] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            
            # Calculate string positions
            string_positions = fret_tracker.get_string_positions(fret_data)
            
            # Draw dots for each string
            for string_idx, y_pos in enumerate(string_positions):
                cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 4, (0, 255, 0), -1)
    except Exception as e:
        print(f"Error drawing scale notes: {str(e)}")

def generate_frames():
    if not initialize_pipeline():
        return

    while True:
        try:
            # Always get the raw camera frame first
            camera = get_camera()
            success, raw_frame = camera.read()
            if not success:
                print("Failed to read camera frame")
                continue

            # If we have a processed frame, use it, otherwise use the raw frame
            display_frame = frame_buffer if frame_buffer is not None else raw_frame.copy()
            
            # Always draw the current scale information
            cv2.putText(display_frame, "Processing...", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)

            # Convert frame to jpg
            ret, buffer = cv2.imencode('.jpg', display_frame)
            if not ret:
                print("Failed to encode frame")
                continue
                
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

        except Exception as e:
            print(f"Error in generate_frames: {str(e)}")
            continue  # Continue instead of break to keep trying

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/get_frets')
def get_frets():
    try:
        if not initialize_pipeline():
            return jsonify({'error': 'Failed to initialize detection pipeline'}), 500

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

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    try:
        print(f"Starting server on port {PORT}")
        app.run(debug=True, host='0.0.0.0', port=PORT)
    finally:
        release_camera()
