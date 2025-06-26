from flask import Flask, Response, render_template, jsonify, request
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
API_KEY = os.getenv('API_KEY', "PXAqQENZCRpDPtJ8rd4w")
MODEL_ID = os.getenv('MODEL_ID', "guitar-frets-segmenter/1")
PORT = int(os.getenv('FLASK_PORT', 8000))

# performance settings - for optimising
MAX_INIT_RETRIES = 2  
INIT_RETRY_DELAY = 0.5 

app = Flask(__name__, static_folder='static', template_folder='templates') #init using Python flask
cors = CORS(app, origins=["*"], supports_credentials=True) #enable CORS for all origins

# init video capture
camera = None
# Initialize fret tracking objects
fret_tracker = FretTracker(num_frets=12, stability_threshold=0.3)
fretboard_notes = FretboardNotes()
pipeline = None
frame_buffer = None

# set initial scale
fretboard_notes.set_scale('C', 'major')

# global confidence threshold
confidence_threshold = 0.3

'''def get_camera():
    """Initialize camera with retries."""
    global camera
    if camera is None:
        try:
            if platform.system() == "Windows":
                camera = cv2.VideoCapture(0, cv2.CAP_DSHOW)
            else:
                camera = cv2.VideoCapture(0)
            if not camera.isOpened():
                raise Exception("Failed to open camera")
            
            # Set camera properties
            camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
            camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
            
            # test read to ensure camera is working
            ret, _ = camera.read()
            if not ret:
                raise Exception("Failed to read from camera")
                
            return camera
        except Exception as e:
            print(f"Camera initialization failed: {str(e)}")
            if camera is not None:
                camera.release()
                camera = None
            raise
    return camera

def release_camera():
    global camera, pipeline
    if camera is not None:
        camera.release()
        camera = None
    if pipeline is not None:
        pipeline.stop()
        pipeline = None'''

def initialize_pipeline():
    """Initialize pipeline."""
    global pipeline
    if pipeline is None:
        try:
            # Ensure camera is initialized first
            '''if get_camera() is None:
                raise Exception("Camera must be initialized before pipeline")'''
                
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

def ensure_initialized():
    """Ensure both camera and pipeline are initialized."""
    try:
        #camera = get_camera()
        if not initialize_pipeline():
            #release_camera()
            return False
        return True
    except Exception as e:
        print(f"Initialization error: {str(e)}")
        #release_camera()
        return False

#main logic for drawing scale notes on the fretboard
def draw_scale_notes(frame, fret_tracker, fretboard_notes): 
    """Draw dots for scale notes on detected frets."""
    try:
        stable_frets = fret_tracker.get_stable_frets()
        
        # display scale information
        scale_text = f"Scale: {fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}"
        notes_text = f"Notes: {', '.join(fretboard_notes.scale_notes)}"
        #controls_text = "Press 'c' for C major, 'a' for A minor, 'g' for G major, 'e' for E minor, 'f' for F major, 'd' for D major"
        
        cv2.putText(frame, scale_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, notes_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
        #cv2.putText(frame, controls_text, (10, frame.shape[0] - 10), 
                   #cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        
        # process frets in order
        for x_center, fret_data in fret_tracker.sorted_frets:
            fret_num = fret_data['fret_num']
            if fret_num < 1:
                continue
            
            # draw fret number
            cv2.putText(frame, f"Fret {fret_num}", 
                       (fret_data['x_center'] - 20, fret_data['y_min'] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            
            # calc string positions
            string_positions = fret_tracker.get_string_positions(fret_data)
            
            # draw dots for each string
            for string_idx, y_pos in enumerate(string_positions):
                # get the note at this pos and check if it's in the scale
                scale_positions = fretboard_notes.get_string_note_positions(string_idx)
                note_name = fretboard_notes.get_note_at_position(string_idx, fret_num)
                
                if fret_num in scale_positions:
                    if note_name == fretboard_notes.selected_root:
                        # root note - red
                        cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 8, (0, 0, 255), -1)
                        cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 9, (255, 255, 255), 1)
                        # Add note name
                        text_x = fret_data['x_center'] + 10
                        text_y = int(y_pos) + 4
                        cv2.putText(frame, note_name, (text_x, text_y),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2, cv2.LINE_AA)
                    else:
                        # scale note - blue
                        cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 6, (255, 0, 0), -1)
                        cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 7, (255, 255, 255), 1)
                        # Add note name
                        text_x = fret_data['x_center'] + 10
                        text_y = int(y_pos) + 4
                        cv2.putText(frame, note_name, (text_x, text_y),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2, cv2.LINE_AA)
                else:
                    # note not in scale - greyed out
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 4, (128, 128, 128), -1)
                
    except Exception as e:
        print(f"Error drawing scale notes: {str(e)}")

def custom_sink(predictions: dict, video_frame: VideoFrame):
    """Custom sink function for the inference pipeline."""
    global frame_buffer
    try:
        frame = video_frame.image.copy()
        
        # update fret tracking with new detections
        fret_tracker.update(predictions.get("predictions", []), frame.shape[0])
        
        # draw scale notes
        draw_scale_notes(frame, fret_tracker, fretboard_notes)

        
        # store the processed frame in the buffer
        frame_buffer = frame
        
        # Return 0 to continue processing
        return 0
    except Exception as e:
        print(f"Error in custom_sink: {str(e)}")
        return 0

def generate_frames():
    """Generate video frames."""
    while True:
        try:
            # get the raw camera frame first
            #camera = get_camera()
            #success, raw_frame = camera.read()
            #if not success:
                #print("Failed to read camera frame")
                #continue

            # use processed frame, but otherwise use the raw frame
            #display_frame = frame_buffer #if frame_buffer is not None #else raw_frame.copy()

            if frame_buffer is None:
                print("Loading frames...")
                time.sleep(0.5)
                continue

            display_frame = frame_buffer.copy()

            # convert frame to jpg
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

@app.route('/')
def index():
    # Initialize camera first
    '''try:
        get_camera()
    except Exception as e:
        print(f"Failed to initialize camera: {str(e)}")
        return render_template('index.html', error="Camera initialization failed")'''
        
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    # ensure camera is initialized before starting video feed
    try:
        '''if get_camera() is None:
            return "Camera not available", 503'''
            
        # Initialize pipeline only after camera is confirmed working
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
    #try:
        print(f"Starting server on port {PORT}")
        app.run(debug=True, host='0.0.0.0', port=PORT)
    #finally:
        #release_camera()