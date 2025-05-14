from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
import fretDetectorCMajorScale as fdcm
import time
import threading

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize FretboardNotes with C major scale
fretboard_notes = fdcm.FretboardNotes()
fretboard_notes.set_scale('C', 'major')

# Initialize fret tracker with more permissive settings
fret_tracker = fdcm.FretTracker(num_frets=12, stability_threshold=0.3)

# Global variables for pipeline
pipeline = None
pipeline_lock = threading.Lock()
pipeline_initialized = False

def initialize_pipeline():
    """Initialize the inference pipeline."""
    global pipeline, pipeline_initialized
    
    with pipeline_lock:
        if pipeline_initialized:
            return True
            
        try:
            print("Initializing inference pipeline...")
            # Create a custom sink function with the fretboard_notes object
            def sink_with_objects(predictions: dict, video_frame: VideoFrame):
                return fdcm.custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
                
            # Initialize the inference pipeline
            pipeline = InferencePipeline.init(
                model_id=fdcm.MODEL_ID,
                api_key=fdcm.API_KEY,
                video_reference=None,
                on_prediction=sink_with_objects
            )
            
            pipeline_initialized = True
            print("Pipeline initialized successfully")
            return True
        except Exception as e:
            print(f"Error initializing pipeline: {str(e)}")
            return False

# Initialize pipeline at startup
initialize_pipeline()

def debug_custom_sink(predictions: dict, video_frame: VideoFrame, fretboard_notes, fret_tracker):
    """A debug version of custom_sink that ensures visualization works."""
    try:
        # Get the frame
        frame = video_frame.image
        
        # Add basic visualization elements
        h, w = frame.shape[:2]
        
        # Draw a grid
        for i in range(0, w, 50):
            cv2.line(frame, (i, 0), (i, h), (0, 255, 255), 1)
        for i in range(0, h, 50):
            cv2.line(frame, (0, i), (w, i), (0, 255, 255), 1)
        
        # Draw fretboard simulation
        for i in range(1, 6):  # Simulate 5 frets
            fret_x = int(w * i / 6)
            cv2.line(frame, (fret_x, 0), (fret_x, h), (0, 255, 0), 2)
            
            # Draw fret number
            cv2.putText(frame, f"Fret {i}", (fret_x - 30, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # Draw strings
        for i in range(6):  # 6 strings
            string_y = int(h * (i + 1) / 7)
            cv2.line(frame, (0, string_y), (w, string_y), (0, 0, 255), 2)
            
            # Label string number
            cv2.putText(frame, f"String {6-i}", (10, string_y - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
        
        # Add scale information
        scale_text = f"Scale: {fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}"
        notes_text = f"Notes: {', '.join(fretboard_notes.scale_notes)}"
        
        cv2.putText(frame, scale_text, (10, h - 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        cv2.putText(frame, notes_text, (10, h - 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        
        # Add timestamp
        timestamp = time.strftime("%H:%M:%S.%f")[:-3]
        cv2.putText(frame, timestamp, (w - 150, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        
        return 0  # Return 0 as key code (no key pressed)
    except Exception as e:
        print(f"Error in debug_custom_sink: {str(e)}")
        return 0

def process_frame(frame):
    """Process a single frame using the inference pipeline."""
    global pipeline, pipeline_initialized
    
    try:
        # Create a VideoFrame object
        video_frame = VideoFrame(
            image=frame.copy(),
            frame_id=int(time.time() * 1000),
            frame_timestamp=time.time()
        )
        
        # Try to use the inference pipeline if it's initialized
        if pipeline_initialized:
            try:
                print("Using inference pipeline...")
                # Use the pipeline's on_prediction callback
                with pipeline_lock:
                    pipeline.process_frame(video_frame)
                print("Pipeline processing complete")
                return video_frame.image
            except Exception as e:
                print(f"Error using inference pipeline: {str(e)}")
                # Fall back to debug version
        
        # If pipeline failed or not initialized, use debug version
        print("Using debug visualization...")
        debug_custom_sink({"predictions": []}, video_frame, fretboard_notes, fret_tracker)
        
        # Add some basic visualization to confirm processing
        processed_frame = video_frame.image
        cv2.putText(processed_frame, "DEBUG MODE", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)
        
        # Return the processed frame
        return processed_frame
        
    except Exception as e:
        print(f"Error in process_frame: {str(e)}")
        cv2.putText(frame, f"Error: {str(e)}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        return frame

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    global pipeline_initialized
    return jsonify({
        'status': 'healthy',
        'message': 'Server is running',
        'pipeline_initialized': pipeline_initialized
    })

@app.route('/detect', methods=['POST'])
def detect_frets():
    try:
        # Get the image data from the request
        data = request.json
        image_data = data['image'].split(',')[1]  # Remove the "data:image/jpeg;base64," part
        
        # Convert base64 to image
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Process the frame
        processed_frame = process_frame(frame)
        
        # Convert the processed frame back to base64
        _, buffer = cv2.imencode('.jpg', processed_frame)
        processed_image = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'success': True,
            'image': f'data:image/jpeg;base64,{processed_image}'
        })
        
    except Exception as e:
        print(f"Error in detect_frets: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/change_scale', methods=['POST'])
def change_scale():
    try:
        data = request.json
        root = data.get('root', 'C')
        scale_type = data.get('scale', 'major')
        
        if root in fdcm.ALL_NOTES:
            fretboard_notes.set_scale(root, scale_type)
            return jsonify({
                'success': True,
                'scale': f'{root} {scale_type}'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Invalid root note'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/debug', methods=['GET'])
def debug():
    """Debug endpoint to check server status and configuration."""
    try:
        # Create a test frame
        test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # Process it with our debug sink
        video_frame = VideoFrame(
            image=test_frame.copy(),
            frame_id=int(time.time() * 1000),
            frame_timestamp=time.time()
        )
        
        # Apply debug visualization
        debug_custom_sink({"predictions": []}, video_frame, fretboard_notes, fret_tracker)
        
        # Convert to base64 for display
        _, buffer = cv2.imencode('.jpg', video_frame.image)
        test_image = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'status': 'ok',
            'pipeline_initialized': pipeline_initialized,
            'fretboard_notes': {
                'root': fretboard_notes.selected_root,
                'scale': fretboard_notes.selected_scale_name,
                'notes': fretboard_notes.scale_notes
            },
            'test_image': f'data:image/jpeg;base64,{test_image}',
            'timestamp': time.strftime("%H:%M:%S")
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/reinitialize', methods=['GET'])
def reinitialize():
    """Force reinitialize the pipeline."""
    global pipeline_initialized
    
    # Reset initialization flag
    with pipeline_lock:
        pipeline_initialized = False
    
    # Try to initialize
    success = initialize_pipeline()
    
    return jsonify({
        'success': success,
        'message': 'Pipeline reinitialized successfully' if success else 'Failed to reinitialize pipeline'
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000) 