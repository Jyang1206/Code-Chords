import cv2
import numpy as np
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
from inference.core.interfaces.stream.sinks import render_boxes
from collections import defaultdict

# Replace with your actual API key and model ID
API_KEY = "YOUR_ROBOFLOW_API_KEY"
MODEL_ID = "guitar-frets-segmenter/1"

# Memory of previous frame polygons
previous_polygons = defaultdict(list)

# Smoothing factor (between 0 - no smoothing, and 1 - very slow response)
ALPHA = 0.8

def custom_sink(predictions: dict, video_frame: VideoFrame):
    frame = video_frame.image.copy()
    detections = predictions.get("predictions", [])

    for idx, det in enumerate(detections):
        det_id = det.get("detection_id")
        label = det.get("class", "")
        points = det.get("points", [])

        if not points or not det_id:
            continue

        # Convert to NumPy polygon
        current_poly = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.float32)

        # Smooth with previous polygon if available
        if previous_polygons[det_id]:
            prev_poly = np.array(previous_polygons[det_id], dtype=np.float32)
            smoothed_poly = ALPHA * prev_poly + (1 - ALPHA) * current_poly
        else:
            smoothed_poly = current_poly

        # Save this frame's polygon for future smoothing
        previous_polygons[det_id] = smoothed_poly

        polygon = smoothed_poly.astype(np.int32)

        # Color and render logic (same as before)
        if label == "Hand":
            outline_color = (255, 255, 0)
            fill_color = (255, 75, 0)
        else:
            outline_color = (0, 255, 0)
            fill_color = tuple(np.random.randint(100, 255, 3).tolist())

        overlay = frame.copy()
        cv2.fillPoly(overlay, [polygon], color=fill_color)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
        cv2.polylines(frame, [polygon], isClosed=True, color=outline_color, thickness=2)

        if label != "Hand":
            sorted_y = sorted(polygon, key=lambda p: p[1])
            top_edge = sorted_y[:2]
            bottom_edge = sorted_y[-2:]
            top_avg = np.mean(top_edge, axis=0)
            bottom_avg = np.mean(bottom_edge, axis=0)
            
            for s in range(6):
                alpha = s / 5.0
                dot = (1 - alpha) * top_avg + alpha * bottom_avg
                cv2.circle(frame, tuple(dot.astype(int)), 3, (0, 0, 255), -1)

    # Display the annotated frame
    cv2.imshow("Fretboard Detection", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        exit()

# Initialize and start the inference pipeline
pipeline = InferencePipeline.init(
    model_id="guitar-frets-segmenter/1",
    api_key="PXAqQENZCRpDPtJ8rd4w",
    video_reference=0,  # 0 for default webcam
    on_prediction=custom_sink,
)

pipeline.start()
pipeline.join()
