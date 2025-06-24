from flask import Flask, Response, render_template, jsonify, request
from flask_cors import CORS
import cv2
import json
import os
import time
import platform
from dotenv import load_dotenv
from fretDetector import FretboardNotes, NeckTracker
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
import numpy as np

# load environment variables
load_dotenv()

# get config from env variables
API_KEY = os.getenv('API_KEY', "PXAqQENZCRpDPtJ8rd4w")
MODEL_ID = "guitar-ppfil/1"
PORT = int(os.getenv('FLASK_PORT', 8000))

# performance settings - for optimising
MAX_INIT_RETRIES = 2  
INIT_RETRY_DELAY = 0.5 

app = Flask(__name__, static_folder='static', template_folder='templates') #init using Python flask
cors = CORS(app, origins=["*"], supports_credentials=True) #enable CORS for all origins

# init video capture
camera = None
# Initialize fret tracking objects
fretboard_notes = FretboardNotes()
neck_tracker = NeckTracker()
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

def deskew_neck(frame, polygon_points):
    try:
        polygon = np.array(polygon_points, dtype=np.float32)
        rect = cv2.minAreaRect(polygon)
        box = cv2.boxPoints(rect)
        box = np.array(box, dtype=np.float32)
        width = int(rect[1][0])
        height = int(rect[1][1])
        print(f"[deskew_neck] rect: {rect}, width: {width}, height: {height}")
        if width == 0 or height == 0:
            print("[deskew_neck] Invalid neck dimensions.")
            raise ValueError("Invalid neck dimensions")
        dst_pts = np.array([
            [0, 0],
            [width - 1, 0],
            [width - 1, height - 1],
            [0, height - 1]
        ], dtype=np.float32)
        M = cv2.getPerspectiveTransform(box, dst_pts)
        warped = cv2.warpPerspective(frame, M, (width, height))
        print(f"[deskew_neck] Warped shape: {warped.shape}")
        return warped, M, box
    except Exception as e:
        print(f"[deskew_neck] Exception: {e}")
        raise

def detect_frets_with_hough(warped_frame, min_angle=75, threshold=40, min_length=25, max_gap=8):
    try:
        gray = cv2.cvtColor(warped_frame, cv2.COLOR_BGR2GRAY)
        # Adaptive thresholding for better contrast
        adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 11, 2)
        # Morphological operations to enhance vertical lines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 15))
        morph = cv2.morphologyEx(adaptive, cv2.MORPH_CLOSE, kernel)
        # Canny edge detection
        edges = cv2.Canny(morph, 40, 120)
        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=threshold,
            minLineLength=min_length,
            maxLineGap=max_gap
        )
        vertical_lines = []
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
                if abs(angle) > min_angle:
                    vertical_lines.append((x1, y1, x2, y2))
        # Sort lines by x (right to left)
        vertical_lines.sort(key=lambda l: -((l[0] + l[2]) // 2))
        merged = []
        for line in vertical_lines:
            if not merged or abs((line[0] + line[2]) // 2 - (merged[-1][0] + merged[-1][2]) // 2) > 8:
                merged.append(line)
        return merged
    except Exception as e:
        print(f"[detect_frets_with_hough] Exception: {str(e)}")
        return []

#main logic for drawing scale notes on the fretboard
def draw_scale_notes(
    warped_frame,
    fret_lines,
    fretboard_notes,
    neck_height,
    inverse_transform=None,
    output_frame=None
):
    try:
        num_frets = len(fret_lines)
        num_strings = 6  # Standard guitar
        string_y_positions = np.linspace(0.1, 0.9, num_strings) * neck_height
        # Build frets from right to left (fret 22 is rightmost, 1 is leftmost)
        for i, fret_idx in enumerate(range(num_frets, 0, -1)):
            if fret_idx <= 0 or fret_idx >= num_frets:
                continue
            x1 = (fret_lines[fret_idx - 1][0] + fret_lines[fret_idx - 1][2]) // 2
            x2 = (fret_lines[fret_idx % num_frets][0] + fret_lines[fret_idx % num_frets][2]) // 2
            x_center = (x1 + x2) // 2
            fret_num = i + 1  # 1 (leftmost) to N (rightmost)
            # Label the fret number between the lines
            if inverse_transform is not None and output_frame is not None:
                label_point = np.array([[[x_center, 30]]], dtype=np.float32)
                label_transformed = cv2.perspectiveTransform(label_point, inverse_transform)[0][0]
                cv2.putText(output_frame, str(num_frets - i), (int(label_transformed[0]), int(label_transformed[1])),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,255), 2, cv2.LINE_AA)
            else:
                cv2.putText(warped_frame, str(num_frets - i), (x_center, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,255), 2, cv2.LINE_AA)
            for string_idx, y in enumerate(string_y_positions):
                y = int(y)
                note_name = fretboard_notes.get_note_at_position(string_idx, num_frets - i)
                scale_positions = fretboard_notes.get_string_note_positions(string_idx)
                if (num_frets - i) in scale_positions:
                    is_root = (note_name == fretboard_notes.selected_root)
                    color = (0, 0, 255) if is_root else (255, 0, 0)
                    radius = 8 if is_root else 6
                    label_color = color
                else:
                    color = (128, 128, 128)
                    radius = 4
                    label_color = None
                point = np.array([[[x_center, y]]], dtype=np.float32)
                if inverse_transform is not None and output_frame is not None:
                    transformed_point = cv2.perspectiveTransform(point, inverse_transform)[0][0]
                    x_draw, y_draw = int(transformed_point[0]), int(transformed_point[1])
                    canvas = output_frame
                else:
                    x_draw, y_draw = x_center, y
                    canvas = warped_frame
                cv2.circle(canvas, (x_draw, y_draw), radius, color, -1)
                cv2.circle(canvas, (x_draw, y_draw), radius + 1, (255, 255, 255), 1)
                if label_color:
                    cv2.putText(canvas, note_name, (x_draw + 10, y_draw + 4),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, label_color, 2, cv2.LINE_AA)
        canvas = output_frame if output_frame is not None else warped_frame
        scale_text = f"Scale: {fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}"
        notes_text = f"Notes: {', '.join(fretboard_notes.scale_notes)}"
        cv2.putText(canvas, scale_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(canvas, notes_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
    except Exception as e:
        print(f"[draw_scale_notes] Exception: {str(e)}")


def custom_sink(predictions: dict, video_frame: VideoFrame):
    """
    Processes each frame: detects the neck, zooms in, finds frets, draws notes, and overlays back.
    """
    global frame_buffer
    if not hasattr(custom_sink, "frame_counter"):
        custom_sink.frame_counter = 0
        custom_sink.last_fret_lines = []
    try:
        frame = video_frame.image.copy()
        # print(f"[custom_sink] Frame shape: {frame.shape}")
        neck_polygon = None
        for det in predictions.get("predictions", []):
            if det.get("class") == "Guitar-necks" and "points" in det:
                neck_polygon = [[pt["x"], pt["y"]] for pt in det["points"]]
                break
        if not neck_polygon or len(neck_polygon) < 4:
            print("[custom_sink] No valid neck polygon found or not enough points.")
            frame_buffer = frame
            return 0
        try:
            warped, M, box = deskew_neck(frame, neck_polygon)
        except Exception as e:
            print(f"[custom_sink] deskew_neck failed: {e}")
            frame_buffer = frame
            return 0
        M_inv = cv2.getPerspectiveTransform(
            np.array([
                [0, 0],
                [warped.shape[1] - 1, 0],
                [warped.shape[1] - 1, warped.shape[0] - 1],
                [0, warped.shape[0] - 1]
            ], dtype=np.float32),
            box
        )
        # Always update fret_lines every frame
        fret_lines = detect_frets_with_hough(warped)
        custom_sink.last_fret_lines = fret_lines
        if not fret_lines or len(fret_lines) < 2:
            print("[custom_sink] Not enough fret lines detected.")
        # Draw Hough lines for debugging
        if fret_lines:
            for (x1, y1, x2, y2) in fret_lines:
                pt1 = np.array([[[x1, y1]]], dtype=np.float32)
                pt2 = np.array([[[x2, y2]]], dtype=np.float32)
                if M_inv is not None:
                    pt1_orig = cv2.perspectiveTransform(pt1, M_inv)[0][0]
                    pt2_orig = cv2.perspectiveTransform(pt2, M_inv)[0][0]
                    cv2.line(frame, (int(pt1_orig[0]), int(pt1_orig[1])), (int(pt2_orig[0]), int(pt2_orig[1])), (0,0,255), 2)
        draw_scale_notes(
            warped_frame=warped,
            fret_lines=fret_lines,
            fretboard_notes=fretboard_notes,
            neck_height=warped.shape[0],
            inverse_transform=M_inv,
            output_frame=frame
        )
        # Draw the neck polygon on the output frame for testing
        neck_poly_np = np.array(neck_polygon, dtype=np.int32)
        cv2.polylines(frame, [neck_poly_np], isClosed=True, color=(0,255,0), thickness=2)
        frame_buffer = frame
    except Exception as e:
        print(f"[custom_sink] Exception: {str(e)}")
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
