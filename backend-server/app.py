from flask import Flask, Response, jsonify, request
from flask_cors import CORS
import cv2
import json
import os
import time
import platform
from dotenv import load_dotenv
from fretDetector import FretTracker, FretboardNotes
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame

# load environment variables
load_dotenv()

# get config from env variables
API_KEY = os.getenv('API_KEY', "tNGaAGE5IufNanaTpyG3")
MODEL_ID = os.getenv('MODEL_ID', "guitar-frets-segmenter 1")
PORT = int(os.getenv('FLASK_PORT', 8000))

app = Flask(__name__, static_folder='static', template_folder='templates')
cors = CORS(app, origins=["*"], supports_credentials=True)

# Initialize fret tracking objects
fret_tracker = FretTracker(num_frets=12, stability_threshold=0.3)
fretboard_notes = FretboardNotes()
pipeline = None
frame_buffer = None

# set initial scale
fretboard_notes.set_scale('C', 'major')

# global confidence threshold
confidence_threshold = 0.3

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
            print(f"Pipeline initialization failed: {str(e)}")
            if pipeline is not None:
                pipeline.stop()
                pipeline = None
            return False
    return True

def draw_scale_notes(frame, fret_tracker, fretboard_notes): 
    try:
        stable_frets = fret_tracker.get_stable_frets()
        scale_text = f"Scale: {fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}"
        notes_text = f"Notes: {', '.join(fretboard_notes.scale_notes)}"
        cv2.putText(frame, scale_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, notes_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
        for x_center, fret_data in fret_tracker.sorted_frets:
            fret_num = fret_data['fret_num']
            if fret_num < 1:
                continue
            cv2.putText(frame, f"Fret {fret_num}", 
                       (fret_data['x_center'] - 20, fret_data['y_min'] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            string_positions = fret_tracker.get_string_positions(fret_data)
            for string_idx, y_pos in enumerate(string_positions):
                scale_positions = fretboard_notes.get_string_note_positions(string_idx)
                note_name = fretboard_notes.get_note_at_position(string_idx, fret_num)
                if fret_num in scale_positions:
                    if note_name == fretboard_notes.selected_root:
                        cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 8, (0, 0, 255), -1)
                        cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 9, (255, 255, 255), 1)
                        text_x = fret_data['x_center'] + 10
                        text_y = int(y_pos) + 4
                        cv2.putText(frame, note_name, (text_x, text_y),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2, cv2.LINE_AA)
                    else:
                        cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 6, (255, 0, 0), -1)
                        cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 7, (255, 255, 255), 1)
                        text_x = fret_data['x_center'] + 10
                        text_y = int(y_pos) + 4
                        cv2.putText(frame, note_name, (text_x, text_y),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2, cv2.LINE_AA)
                else:
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 4, (128, 128, 128), -1)
    except Exception as e:
        print(f"Error drawing scale notes: {str(e)}")

def custom_sink(predictions: dict, video_frame: VideoFrame):
    global frame_buffer
    try:
        frame = video_frame.image.copy()
        fret_tracker.update(predictions.get("predictions", []), frame.shape[0])
        draw_scale_notes(frame, fret_tracker, fretboard_notes)
        frame_buffer = frame
        return 0
    except Exception as e:
        print(f"Error in custom_sink: {str(e)}")
        return 0

def generate_frames():
    while True:
        try:
            if frame_buffer is None:
                print("Loading frames...")
                time.sleep(0.5)
                continue
            display_frame = frame_buffer.copy()
            ret, buffer = cv2.imencode('.jpg', display_frame)
            if not ret:
                print("Failed to encode frame")
                continue
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        except Exception as e:
            print(f"Error in generate_frames: {str(e)}")
            continue

@app.route('/video_feed')
def video_feed():
    try:
        if not initialize_pipeline():
            return "Failed to initialize detection system", 503
        return Response(generate_frames(),
                       mimetype='multipart/x-mixed-replace; boundary=frame')
    except Exception as e:
        print(f"Error in video feed: {str(e)}")
        return str(e), 503

@app.route('/get_frets')
def get_frets():
    try:
        stable_frets = fret_tracker.get_stable_frets()
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

@app.route('/change_scale', methods=['POST'])
def change_scale():
    try:
        data = request.get_json()
        root = data.get('root')
        scale_type = data.get('scale_type')
        if not root or not scale_type:
            return jsonify({'error': 'Missing root or scale type'}), 400
        fretboard_notes.set_scale(root, scale_type)
        return jsonify({'status': 'success', 'message': f'Changed scale to {root} {scale_type}'})
    except Exception as e:
        print(f"Error changing scale: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/update_confidence', methods=['POST'])
def update_confidence():
    try:
        data = request.get_json()
        threshold = data.get('threshold')
        if threshold is not None:
            fret_tracker.stability_threshold = float(threshold)
            return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    return jsonify({'error': 'Invalid request'}), 400

if __name__ == '__main__':
    print(f"Starting server on port {PORT}")
    app.run(debug=True, host='0.0.0.0', port=PORT)
