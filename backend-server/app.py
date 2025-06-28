from flask import Flask, Response, render_template, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import cv2
import json
import os
import time
import platform
from dotenv import load_dotenv
from fretDetector import FretTracker, FretboardNotes, custom_sink, VideoFrame
import base64
import numpy as np
import datetime

# load environment variables
load_dotenv()

# get config from env variables
API_KEY = os.getenv('API_KEY', "PXAqQENZCRpDPtJ8rd4w")
MODEL_ID = os.getenv('MODEL_ID', "guitar-frets-segmenter/1")
PORT = int(os.getenv('FLASK_PORT', 8000))

app = Flask(__name__, static_folder='static', template_folder='templates')
cors = CORS(app, origins=["*"], supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Initialize fret tracking objects
fret_tracker = FretTracker(num_frets=12, stability_threshold=0.3)
fretboard_notes = FretboardNotes()

# set initial scale
fretboard_notes.set_scale('C', 'major')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

@app.route('/process_frame', methods=['POST'])
def process_frame():
    """Process a single frame from React frontend and return annotated frame."""
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
            
        # Extract base64 image data
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]  # Remove data:image/jpeg;base64,
        
        # Decode base64 to numpy array
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({'error': 'Failed to decode image'}), 400

        # Create VideoFrame object for processing
        video_frame = VideoFrame(
            image=img,
            frame_id=0,
            frame_timestamp=datetime.datetime.now()
        )
        
        # Mock predictions for now (empty dict)
        predictions = {}
        
        # Use existing custom_sink function to draw notes and get processed frame
        processed_img = custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
        
        # Encode processed image to base64
        _, buffer = cv2.imencode('.jpg', processed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        processed_image_b64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
        processed_image_uri = f"data:image/jpeg;base64,{processed_image_b64}"
        
        return jsonify({
            'processed_image': processed_image_uri,
            'status': 'success'
        })
                
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
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
    try:
        # Extract base64 image data
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64 to numpy array
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            emit('frame_processed', {'error': 'Failed to decode image'})
            return

        # Create VideoFrame object
        video_frame = VideoFrame(
            image=img,
            frame_id=0,
            frame_timestamp=datetime.datetime.now()
        )
        
        # Mock predictions for now (empty dict)
        predictions = {}
        
        # Get the processed frame from custom_sink
        processed_img = custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
        
        # Encode to base64
        _, buffer = cv2.imencode('.jpg', processed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        processed_image_b64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
        processed_image_uri = f"data:image/jpeg;base64,{processed_image_b64}"
        
        # Send back via WebSocket
        emit('frame_processed', {
            'processed_image': processed_image_uri,
            'status': 'success'
        })
                
    except Exception as e:
        print(f"WebSocket frame processing error: {str(e)}")
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

if __name__ == '__main__':
    print(f"Starting server on port {PORT}")
    print("Server ready for WebSocket connections!")
    socketio.run(app, debug=True, host='0.0.0.0', port=PORT)