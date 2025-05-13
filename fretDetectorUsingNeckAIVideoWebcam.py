import cv2
import numpy as np
import math
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
from collections import defaultdict

API_KEY = "PXAqQENZCRpDPtJ8rd4w"
MODEL_ID = "guitar-frets-segmenter/1"

previous_polygons = defaultdict(list)
ALPHA = 1.0

# Accurate tilt using SVD
def calculate_tilt_from_polygon(polygon):
    points = polygon.astype(np.float32)
    centroid = np.mean(points, axis=0)
    centered = points - centroid
    _, _, vh = np.linalg.svd(centered)
    direction = vh[0]  # First principal component
    angle_rad = math.atan2(direction[1], direction[0])
    return angle_rad

def custom_sink(predictions: dict, video_frame: VideoFrame):
    frame = video_frame.image.copy()
    detections = predictions.get("predictions", [])

    for idx, det in enumerate(detections):
        det_id = det.get("detection_id")
        label = det.get("class", "")
        points = det.get("points", [])

        if not points or not det_id:
            continue

        current_poly = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.float32)

        if previous_polygons[det_id]:
            prev_poly = np.array(previous_polygons[det_id], dtype=np.float32)
            smoothed_poly = ALPHA * prev_poly + (1 - ALPHA) * current_poly
        else:
            smoothed_poly = current_poly

        previous_polygons[det_id] = smoothed_poly
        polygon = smoothed_poly.astype(np.int32)

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

            angle_rad = calculate_tilt_from_polygon(polygon)
            length = np.linalg.norm(bottom_avg - top_avg)

            for s in range(6):
                alpha = s / 5.0
                offset = alpha * length
                dot_x = top_avg[0] + offset * abs(math.cos(angle_rad))
                dot_y = top_avg[1] + offset * abs(math.sin(angle_rad))
                cv2.circle(frame, (int(dot_x), int(dot_y)), 7, (0, 0, 255), -1)

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
