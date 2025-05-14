import cv2
import numpy as np
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame

API_KEY = "PXAqQENZCRpDPtJ8rd4w"
MODEL_ID = "guitar-frets-segmenter/1"

def draw_fret_dots(frame, polygon):
    """Draw dots along the fret polygon."""
    y_coords = polygon[:, 1]
    y_min = np.min(y_coords)
    y_max = np.max(y_coords)
    x_center = int(np.mean(polygon[:, 0]))
    
    # Pre-calculate y positions
    y_positions = np.linspace(y_min, y_max, 6, dtype=np.int32)
    
    # Draw red dots
    for y in y_positions:
        cv2.circle(frame, (x_center, int(y)), 4, (0, 0, 255), -1)

def custom_sink(predictions: dict, video_frame: VideoFrame):
    frame = video_frame.image.copy()
    detections = predictions.get("predictions", [])
    
    # Process each detection
    for det in detections:
        if det.get("class", "") == "Hand" or not det.get("points"):
            continue

        # Get polygon points
        polygon = np.array([[pt["x"], pt["y"]] for pt in det["points"]], dtype=np.int32)
        
        # Draw fret outline in green
        cv2.polylines(frame, [polygon], isClosed=True, color=(0, 255, 0), thickness=2)
        
        # Draw red dots
        draw_fret_dots(frame, polygon)

    cv2.imshow("Fretboard Detection", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        exit()

pipeline = InferencePipeline.init(
    model_id=MODEL_ID,
    api_key=API_KEY,
    video_reference=0,
    on_prediction=custom_sink,
)

pipeline.start()
pipeline.join()