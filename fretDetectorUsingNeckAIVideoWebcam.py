import cv2
import numpy as np
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame

API_KEY = "PXAqQENZCRpDPtJ8rd4w"
MODEL_ID = "guitar-frets-segmenter/1"

def find_center_points(polygon):
    # Get bounding box
    x_min = np.min(polygon[:, 0])
    x_max = np.max(polygon[:, 0])
    y_min = np.min(polygon[:, 1])
    y_max = np.max(polygon[:, 1])
    
    # Find center x-coordinate
    center_x = (x_min + x_max) / 2
    
    # Find points near top and bottom edges
    top_y = y_min
    bottom_y = y_max
    
    return np.array([center_x, top_y]), np.array([center_x, bottom_y])

def custom_sink(predictions: dict, video_frame: VideoFrame):
    frame = video_frame.image.copy()
    detections = predictions.get("predictions", [])

    for det in detections:
        label = det.get("class", "")
        points = det.get("points", [])

        if not points:
            continue

        polygon = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.int32)

        # Draw the filled polygon
        if label == "Hand":
            cv2.polylines(frame, [polygon], isClosed=True, color=(255, 255, 0), thickness=2)
        else:
            # Draw fret polygon
            cv2.polylines(frame, [polygon], isClosed=True, color=(0, 255, 0), thickness=2)
            
            # Get top and bottom center points
            top_point, bottom_point = find_center_points(polygon)
            
            # Draw dots vertically from top to bottom
            for i in range(6):
                ratio = i / 5.0  # Evenly space 6 dots
                point = np.array([
                    top_point[0],  # Keep x constant (vertical line)
                    top_point[1] + ratio * (bottom_point[1] - top_point[1])  # Interpolate y only
                ], dtype=np.int32)
                
                cv2.circle(frame, tuple(point), 4, (0, 0, 255), -1)

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