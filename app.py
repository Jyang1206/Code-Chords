from flask import Flask, Response, render_template, jsonify, request
from flask_cors import CORS
import cv2
import numpy as np
import mediapipe as mp
import json
import torch
from ultralytics import YOLO

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Initialize video capture
camera = None

def get_camera():
    global camera
    if camera is None:
        camera = cv2.VideoCapture(0)
        camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    return camera

def release_camera():
    global camera
    if camera is not None:
        camera.release()
        camera = None

class FretDetector:
    def __init__(self):
        # Initialize MediaPipe Hands
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )
        
        # Initialize tracking variables
        self.previous_frets = []
        self.smoothing_factor = 0.3
        self.frame_buffer = []
        self.buffer_size = 5
        
        # Load YOLO model for fretboard detection
        try:
            self.fretboard_model = YOLO('best.pt')  # Load your trained YOLO model
        except Exception as e:
            print(f"Error loading YOLO model: {e}")
            self.fretboard_model = None

    def detect_fretboard(self, frame):
        if self.fretboard_model is None:
            return None
        
        results = self.fretboard_model(frame)
        if len(results) > 0 and len(results[0].boxes) > 0:
            box = results[0].boxes[0]  # Get the first detected fretboard
            return box.xyxy[0].cpu().numpy()  # Convert to numpy array
        return None

    def process_frame(self, frame):
        # Convert the BGR image to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Detect fretboard
        fretboard_box = self.detect_fretboard(rgb_frame)
        
        # Process hands
        results = self.hands.process(rgb_frame)
        
        detected_frets = []
        if results.multi_hand_landmarks and fretboard_box is not None:
            hand_landmarks = results.multi_hand_landmarks[0]
            
            # Extract finger positions relative to fretboard
            for finger_tip in [4, 8, 12, 16, 20]:  # Index for each fingertip
                x = int(hand_landmarks.landmark[finger_tip].x * frame.shape[1])
                y = int(hand_landmarks.landmark[finger_tip].y * frame.shape[0])
                
                # Check if finger is within fretboard bounds
                if (fretboard_box[0] <= x <= fretboard_box[2] and 
                    fretboard_box[1] <= y <= fretboard_box[3]):
                    detected_frets.append((x, y))
        
        # Apply smoothing using frame buffer
        self.frame_buffer.append(detected_frets)
        if len(self.frame_buffer) > self.buffer_size:
            self.frame_buffer.pop(0)
        
        # Average the positions over the buffer
        smoothed_frets = []
        if self.frame_buffer:
            # Only process if we have valid detections
            valid_frames = [frame for frame in self.frame_buffer if frame]
            if valid_frames:
                for i in range(min(len(f) for f in valid_frames)):
                    x_avg = sum(frame[i][0] for frame in valid_frames) / len(valid_frames)
                    y_avg = sum(frame[i][1] for frame in valid_frames) / len(valid_frames)
                    smoothed_frets.append((int(x_avg), int(y_avg)))
        
        return smoothed_frets, fretboard_box

# Initialize fret detector
fret_detector = FretDetector()

def generate_frames():
    while True:
        camera = get_camera()
        success, frame = camera.read()
        if not success:
            break
        
        # Process frame
        frets, fretboard = fret_detector.process_frame(frame)
        
        # Draw detections
        if fretboard is not None:
            cv2.rectangle(frame, 
                         (int(fretboard[0]), int(fretboard[1])), 
                         (int(fretboard[2]), int(fretboard[3])), 
                         (0, 255, 0), 2)
        
        for fret in frets:
            cv2.circle(frame, fret, 5, (0, 0, 255), -1)
        
        # Convert frame to jpg
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/get_frets')
def get_frets():
    camera = get_camera()
    success, frame = camera.read()
    if not success:
        return jsonify({'error': 'Failed to capture frame'})
    
    frets, fretboard = fret_detector.process_frame(frame)
    return jsonify({
        'frets': frets,
        'fretboard': fretboard.tolist() if fretboard is not None else None
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    try:
        app.run(debug=True, host='0.0.0.0', port=5000)
    finally:
        release_camera()
