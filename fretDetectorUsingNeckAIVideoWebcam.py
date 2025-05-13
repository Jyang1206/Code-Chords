import cv2
import numpy as np
import math
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
from collections import defaultdict

API_KEY = "PXAqQENZCRpDPtJ8rd4w"
MODEL_ID = "guitar-frets-segmenter/1"

previous_polygons = defaultdict(list)
ALPHA = 0.2

def custom_sink(predictions: dict, video_frame: VideoFrame):
    frame = video_frame.image.copy()
    detections = predictions.get("predictions", [])

    for det in detections:
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

        # Draw the filled polygon
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

        # Only draw dots for frets
        if label != "Hand":
            # Sort to get top and bottom edges
            sorted_y = sorted(polygon, key=lambda p: p[1])
            top_avg = np.mean(sorted_y[:2], axis=0)
            bottom_avg = np.mean(sorted_y[-2:], axis=0)

            # Principal direction via SVD
            origin = np.mean(polygon, axis=0)
            centered = polygon - origin
            _, _, vh = np.linalg.svd(centered)
            direction = vh[0]

            # Align direction with vertical axis (bottom - top)
            ref_vector = bottom_avg - top_avg
            if np.dot(direction, ref_vector) < 0:
                direction = -direction

            # Project all points to line and get min projection (start of fret)
            projections = (centered @ direction)
            min_proj = np.min(projections)
            max_proj = np.max(projections)
            length = max_proj - min_proj

            # Start drawing dots from the bottom edge along the direction
            start_point = origin + min_proj * direction

            for i in range(6):
                alpha = i / 5.0
                offset = alpha * length
                point = start_point + offset * direction
                if cv2.pointPolygonTest(polygon, tuple(point), False) >= 0:
                    cv2.circle(frame, tuple(point.astype(int)), 7, (0, 0, 255), -1)

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
