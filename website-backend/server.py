from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
from inference import InferencePipeline
from fretDetectorCMajorScale import FretboardNotes, ALL_NOTES

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize FretboardNotes
fretboard_notes = FretboardNotes()
fretboard_notes.set_scale('C', 'major')

def process_frame(frame):
    """Process a single frame and return the annotated frame with detections."""
    # Initialize the inference pipeline (you might want to do this once and reuse)
    pipeline = InferencePipeline.init(
        model_id="guitar-frets-segmenter/1",
        api_key="PXAqQENZCRpDPtJ8rd4w"
    )
    
    # Get predictions
    predictions = pipeline.infer(frame)
    
    # Draw detections
    detections = predictions.get("predictions", [])
    
    # Process each detection
    for string_idx, det in enumerate(detections):
        if det.get("class", "") == "Hand" or not det.get("points"):
            continue

        # Get polygon points
        polygon = np.array([[pt["x"], pt["y"]] for pt in det["points"]], dtype=np.int32)
        
        # Draw fret outline in green
        cv2.polylines(frame, [polygon], isClosed=True, color=(0, 255, 0), thickness=2)
        
        # Draw scale notes (simplified version)
        y_coords = polygon[:, 1]
        y_min = np.min(y_coords)
        y_max = np.max(y_coords)
        x_center = int(np.mean(polygon[:, 0]))
        
        # Calculate string positions (6 strings)
        y_strings = np.linspace(y_min, y_max, 6, dtype=np.int32)
        
        for string_idx, y_pos in enumerate(y_strings):
            scale_positions = fretboard_notes.get_string_note_positions(string_idx)
            if string_idx + 1 in scale_positions:
                cv2.circle(frame, (x_center, int(y_pos)), 8, (255, 0, 0), -1)
    
    # Add scale information
    scale_text = f"Scale: {fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}"
    cv2.putText(frame, scale_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    
    return frame

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
        
        if root in ALL_NOTES:
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

if __name__ == '__main__':
    app.run(debug=True, port=5000) 