import cv2
import numpy as np
import math
from collections import defaultdict
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame

API_KEY = "PXAqQENZCRpDPtJ8rd4w"
FRET_MODEL = "guitar-frets-segmenter/1"
FRETBOARD_MODEL = "guitar-fretboard-detector/1"

# Smoothing
ALPHA = 0.8
previous_polygons = defaultdict(list)

# Initialize a secondary client for manual inference
from inference_sdk import InferenceHTTPClient
client = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key=API_KEY
)

cached_tilt = 0
tilt_alpha = 0.8  # EMA smoothing
frame_counter = 0
tilt_interval = 6  # Recalculate tilt every 6 frames

def calc_tilt(frame, client):
    global cached_tilt, frame_counter

    frame_counter += 1
    if frame_counter % tilt_interval != 0:
        return cached_tilt  # Use cached value

    try:
        result = client.infer(frame, model_id="guitar-fretboard-detector/1")
        detections = result.get("predictions", [])
        if not detections:
            return cached_tilt

        # Find largest polygon (assumes it's the fretboard)
        largest_det = max(detections, key=lambda d: len(d.get("points", [])))
        points = largest_det.get("points", [])
        if len(points) < 2:
            return cached_tilt

        # Use topmost and bottommost points to define vertical axis
        poly = np.array([[pt["x"], pt["y"]] for pt in points])
        sorted_by_y = poly[np.argsort(poly[:, 1])]
        top = sorted_by_y[0]
        bottom = sorted_by_y[-1]

        dy = bottom[1] - top[1]
        dx = bottom[0] - top[0]
        angle = math.degrees(math.atan2(dy, dx))

        # Smooth with previous value
        cached_tilt = tilt_alpha * cached_tilt + (1 - tilt_alpha) * angle
        return cached_tilt

    except Exception as e:
        print("Tilt error:", e)
        return cached_tilt  # fallback

def custom_sink(predictions: dict, video_frame: VideoFrame):
    frame = video_frame.image.copy()
    detections = predictions.get("predictions", [])

    # Calculate fretboard tilt angle (in degrees)
    tilt = calc_tilt(frame, client)

    for det in detections:
        det_id = det.get("detection_id")
        label = det.get("class", "")
        points = det.get("points", [])
        if not points or not det_id:
            continue

        # Convert to polygon
        current_poly = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.float32)

        # Smooth with previous
        if previous_polygons[det_id]:
            prev_poly = np.array(previous_polygons[det_id], dtype=np.float32)
            smoothed_poly = ALPHA * prev_poly + (1 - ALPHA) * current_poly
        else:
            smoothed_poly = current_poly
        previous_polygons[det_id] = smoothed_poly
        polygon = smoothed_poly.astype(np.int32)

        # Render polygon fill and outline
        if label == "Hand":
            fill_color = (255, 75, 0)
            outline_color = (255, 255, 0)
        else:
            fill_color = tuple(np.random.randint(100, 255, 3).tolist())
            outline_color = (0, 255, 0)

        overlay = frame.copy()
        cv2.fillPoly(overlay, [polygon], color=fill_color)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
        cv2.polylines(frame, [polygon], isClosed=True, color=outline_color, thickness=2)

        if label != "Hand":
            # Get average vertical midline
            sorted_y = sorted(polygon, key=lambda p: p[1])
            top_edge = sorted_y[:2]
            bottom_edge = sorted_y[-2:]
            top_avg = np.mean(top_edge, axis=0)
            bottom_avg = np.mean(bottom_edge, axis=0)

           # Apply tilt angle
            angle_rad = math.radians(tilt)
            dx = math.cos(angle_rad)
            dy = math.sin(angle_rad)

            for s in range(6):
                alpha = s / 5.0  # spacing between 0 and 1
                dot_x = top_avg[0] + alpha * (bottom_avg[1] - top_avg[1]) * dx
                dot_y = top_avg[1] + alpha * (bottom_avg[1] - top_avg[1]) * dy
                cv2.circle(frame, (int(dot_x), int(dot_y)), 7, (0, 0, 255), -1)

    # Show result
    cv2.imshow("Fretboard Detection", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        exit()

# Launch main inference pipeline
pipeline = InferencePipeline.init(
    model_id=FRET_MODEL,
    api_key=API_KEY,
    video_reference=0,
    on_prediction=custom_sink,
)
pipeline.start()
pipeline.join()
