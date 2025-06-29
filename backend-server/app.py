from flask import Flask, Response, render_template, jsonify, request
from flask_cors import CORS
import cv2
import json
import os
import time
import platform
from dotenv import load_dotenv
from guitar_processor import GuitarProcessor
import base64
import numpy as np
from datetime import datetime

# load environment variables
load_dotenv()

# get config from env variables
API_KEY = os.getenv('API_KEY', "PXAqQENZCRpDPtJ8rd4w")
MODEL_ID = os.getenv('MODEL_ID', "guitar-frets-segmenter/1")
PORT = int(os.getenv('FLASK_PORT', 8000))

app = Flask(__name__, static_folder='static', template_folder='templates')
cors = CORS(app, origins=["*"], supports_credentials=True)

# Global variables for MJPEG streaming
webcam = None
streaming_active = False
stream_thread = None

# Instantiate GuitarProcessor
processor = GuitarProcessor()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

@app.route('/process_frame', methods=['POST'])
def process_frame():
    request_start = time.time()
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        processed_img = processor.process_frame(img)
        _, buffer = cv2.imencode('.jpg', processed_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        processed_image_b64 = base64.b64encode(buffer.tobytes()).decode('utf-8')
        processed_image_uri = f"data:image/jpeg;base64,{processed_image_b64}"
        return jsonify({'processed_image': processed_image_uri, 'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/change_scale', methods=['POST'])
def change_scale():
    try:
        data = request.get_json()
        root = data.get('root')
        scale_type = data.get('scale_type')
        if not root or not scale_type:
            return jsonify({'error': 'Missing root or scale type'}), 400
        result = processor.change_scale(root, scale_type)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_frets')
def get_frets():
    try:
        fret_data = processor.get_frets()
        return jsonify({'frets': fret_data, 'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/mjpeg_stream')
def mjpeg_stream():
    processor.streaming_active = True
    return Response(processor.generate_mjpeg_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/start_stream')
def start_stream():
    processor.streaming_active = True
    return jsonify({'status': 'success', 'message': 'Stream started'})

@app.route('/stop_stream')
def stop_stream():
    processor.streaming_active = False
    return jsonify({'status': 'success', 'message': 'Stream stopped'})

@app.route('/webcam_capture')
def webcam_capture():
    try:
        if not processor.init_webcam():
            return jsonify({'error': 'Failed to initialize webcam'}), 500
        if processor.webcam is None or not processor.webcam.isOpened():
            return jsonify({'error': 'Webcam not available'}), 500
        ret, frame = processor.webcam.read()
        if not ret:
            return jsonify({'error': 'Failed to read frame from webcam'}), 500
        processed_frame = processor.process_frame(frame)
        _, buffer = cv2.imencode('.jpg', processed_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        frame_bytes = buffer.tobytes()
        return Response(frame_bytes, mimetype='image/jpeg')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/test_roboflow', methods=['POST'])
def test_roboflow():
    try:
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        result = processor.test_roboflow(img)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print(f"Starting server on port {PORT}")
    print("Server ready for WebSocket connections!")
    app.run(debug=True, host='0.0.0.0', port=PORT)