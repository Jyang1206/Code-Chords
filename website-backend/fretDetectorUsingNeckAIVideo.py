import cv2
import numpy as np
from inference_sdk import InferenceHTTPClient
import time

# Initialize the Roboflow client
client = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key="PXAqQENZCRpDPtJ8rd4w"
)

# Open the video
video_path = "Videos/AcousticStock1.mp4"
cap = cv2.VideoCapture(video_path)

# Frame skipping (for speed)
skip_every_n_frames = 2
frame_count = 0

# Define color palette for frets
def get_color(idx):
    np.random.seed(idx)
    return tuple(np.random.randint(0, 255, 3).tolist())

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Skip frames for speed
    if frame_count % skip_every_n_frames != 0:
        frame_count += 1
        continue

    output = frame.copy()

    # Run inference directly on the frame (as image)
    result = client.infer(frame, model_id="guitar-frets-segmenter/1")
    detections = result.get("predictions", [])

    for idx, det in enumerate(detections):
        points = det.get("points", [])
        if not points:
            continue

        polygon = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.int32)

        cls = det.get("class", "")
        if cls == "Hand":
            hand_overlay = output.copy()
            cv2.fillPoly(hand_overlay, [polygon], color=(255, 75, 0))
            cv2.addWeighted(hand_overlay, 0.3, output, 0.7, 0, output)
            cv2.polylines(output, [polygon], True, (255, 255, 0), 2)
            continue

        # Colored overlay for each fret
        fret_overlay = output.copy()
        color = get_color(idx)
        cv2.fillPoly(fret_overlay, [polygon], color)
        cv2.addWeighted(fret_overlay, 0.3, output, 0.7, 0, output)
        cv2.polylines(output, [polygon], True, color, 2)

        # Align dots between top and bottom of the fret polygon
        sorted_pts = sorted(polygon, key=lambda p: p[1])  # sort by y (top to bottom)
        top_center = sorted_pts[0]
        bottom_center = sorted_pts[-1]

        # Interpolate 6 dots (strings) between top and bottom
        for s in range(6):
            alpha = s / 5
            dot_x = int((1 - alpha) * top_center[0] + alpha * bottom_center[0])
            dot_y = int((1 - alpha) * top_center[1] + alpha * bottom_center[1])
            cv2.circle(output, (dot_x, dot_y), 3, (0, 0, 255), -1)

    # Display in OpenCV window
    cv2.imshow("Fretboard Detection", output)

    # Press 'q' to quit early
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

    frame_count += 1

cap.release()
cv2.destroyAllWindows()
