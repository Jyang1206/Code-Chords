import cv2
import numpy as np
from inference_sdk import InferenceHTTPClient

# Initialize the Roboflow client
client = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key="PXAqQENZCRpDPtJ8rd4w"
)

# Open input video
cap = cv2.VideoCapture("Videos/AcousticStock1.mp4")  # replace with your video path

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    output = frame.copy()

    # Save frame temporarily for inference
    temp_path = "temp_frame.jpg"
    cv2.imwrite(temp_path, frame)

    # Run inference
    result = client.infer(temp_path, model_id="guitar-frets-segmenter/1")
    detections = result.get("predictions", [])

    for det in detections:
        points = det.get("points", [])
        if not points:
            continue

        polygon = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.int32)

        if det.get("class", "").lower() == "hand":
            cv2.polylines(output, [polygon], isClosed=True, color=(255, 255, 0), thickness=2)
            overlay = output.copy()
            cv2.fillPoly(overlay, [polygon], color=(255, 75, 0))
            cv2.addWeighted(overlay, 0.3, output, 0.7, 0, output)
            continue

        # Fill fret polygon with green
        overlay = output.copy()
        cv2.polylines(output, [polygon], isClosed=True, color=(0, 255, 0), thickness=2)
        cv2.fillPoly(overlay, [polygon], color=(0, 255, 0))
        cv2.addWeighted(overlay, 0.3, output, 0.7, 0, output)

        # Compute vertical center axis
        x_vals = [p["x"] for p in det["points"]]
        y_vals = [p["y"] for p in det["points"]]
        min_x, max_x = min(x_vals), max(x_vals)
        top_center = ((min_x + max_x) / 2, min(y_vals))
        bottom_center = ((min_x + max_x) / 2, max(y_vals))

        # Draw 6 fret string dots
        for s in range(6):
            alpha = s / 5
            dot_x = top_center[0] * (1 - alpha) + bottom_center[0] * alpha
            dot_y = top_center[1] * (1 - alpha) + bottom_center[1] * alpha
            cv2.circle(output, (int(dot_x), int(dot_y)), radius=3, color=(50, 50, 255), thickness=-1)

    # Show the frame
    cv2.imshow("Fretboard Detection", output)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
