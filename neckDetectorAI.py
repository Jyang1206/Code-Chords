import cv2
import requests
import numpy as np
from inference_sdk import InferenceHTTPClient

# Initialize the Roboflow client
client = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key="PXAqQENZCRpDPtJ8rd4w"  # Use your Roboflow publishable key
)

# Image path
image_path = "Photos/AcousticStock2.jpg"

# Send the image to the model
result = client.infer(
    image_path,
    model_id="guitar-fretboard/3"
)

# Load image for drawing
image = cv2.imread(image_path)

# --- Draw Results ---
detections = result['predictions']
output = image.copy()

for pred in detections:
    x_center, y_center = pred["x"], pred["y"]
    width, height = pred["width"], pred["height"]
    label = pred["class"]
    short_label = label.replace("Zone", "")

    # Get top-left and bottom-right
    x1, y1 = int(x_center - width / 2), int(y_center - height / 2)
    x2, y2 = int(x_center + width / 2), int(y_center + height / 2)

    # Create polygon (simulate perspective tilt if needed)
    tilt = int(0.15 * height)  # Simulate angle

    pts = np.array([
        [x1 + tilt, y1],
        [x2 + tilt, y1],
        [x2 - tilt, y2],
        [x1 - tilt, y2]
    ], np.int32)
    pts = pts.reshape((-1, 1, 2))

    # Draw polygon
    cv2.polylines(output, [pts], isClosed=True, color=(0, 255, 0), thickness=2)

    # Draw label background
    (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
    label_bg_top_left = (x1, y1 - text_h - 4)
    label_bg_bottom_right = (x1 + text_w + 4, y1)
    cv2.rectangle(output, label_bg_top_left, label_bg_bottom_right, (0, 255, 0), -1)

    # Label text
    cv2.putText(output, short_label, (x1 + 2, y1 - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)

    # Draw 6 evenly spaced red dots (representing strings)
    num_strings = 6
    for i, y in enumerate(np.linspace(y1, y2, num=num_strings)):
        dot_y = int(y)
        dot_x = (pts[0][0][0] + pts[3][0][0]) // 2  # Center x between left-side points
        cv2.circle(output, (dot_x, dot_y), radius=4, color=(0, 0, 255), thickness=-1)

# Show result
cv2.imshow("Roboflow Detection", output)
cv2.waitKey(0)
cv2.destroyAllWindows()