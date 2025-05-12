import cv2
import numpy as np
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
from inference.core.interfaces.stream.sinks import render_boxes

# Replace with your actual API key and model ID
API_KEY = "YOUR_ROBOFLOW_API_KEY"
MODEL_ID = "guitar-frets-segmenter/1"

def custom_sink(predictions: dict, video_frame: VideoFrame):
    frame = video_frame.image.copy()
    detections = predictions.get("predictions", [])

    for idx, det in enumerate(detections):
        points = det.get("points", [])
        if not points:
            continue

        polygon = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.int32)
        cls = det.get("class", "").lower()

        if cls == "hand":
            overlay = frame.copy()
            cv2.fillPoly(overlay, [polygon], color=(255, 75, 0))
            cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)
            cv2.polylines(frame, [polygon], True, (255, 255, 0), 2)
            continue

        # Assign a unique color for each fret
        color = tuple(int(c) for c in np.random.choice(range(256), size=3))
        overlay = frame.copy()
        cv2.fillPoly(overlay, [polygon], color)
        cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)
        cv2.polylines(frame, [polygon], True, color, 2)

        # Align dots between top and bottom of the fret polygon
        sorted_pts = sorted(polygon, key=lambda p: p[1])  # sort by y (top to bottom)
        top_center = sorted_pts[0]
        bottom_center = sorted_pts[-1]

        # Interpolate 6 dots (strings) between top and bottom
        for s in range(6):
            alpha = s / 5
            dot_x = int((1 - alpha) * top_center[0] + alpha * bottom_center[0])
            dot_y = int((1 - alpha) * top_center[1] + alpha * bottom_center[1])
            cv2.circle(frame, (dot_x, dot_y), 3, (0, 0, 255), -1)

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
