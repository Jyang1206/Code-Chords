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
image_path = "Photos/PersonStock1.jpg"

# Send the image to the model
result = client.infer(
    image_path,
    model_id="guitar-frets-segmenter/1"
)

# Load image for drawing
image = cv2.imread(image_path)

# --- Draw Results ---
detections = result['predictions']
output = image.copy()

for pred in detections:
    x1, y1 = int(pred["x"] - pred["width"] / 2), int(pred["y"] - pred["height"] / 2)
    x2, y2 = int(pred["x"] + pred["width"] / 2), int(pred["y"] + pred["height"] / 2)
    label = pred["class"]
    short_label = label.replace("Zone", "")

    # Draw bounding box
    cv2.rectangle(output, (x1, y1), (x2, y2), (0, 255, 0), 2)

    # Draw label background
    (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
    cv2.rectangle(output, (x1, y1 - text_h - 4), (x1 + text_w + 4, y1), (0, 255, 0), -1)
    cv2.putText(output, label, (x1 + 2, y1 - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)


    num_strings = 6;
   # Draw 6 evenly spaced red dots (representing guitar strings)
    box_height = y2 - y1
    spacing = box_height // 6
    center_x = (x1 + x2) // 2  # horizontally center the dot in the fret zone

    for i in range(num_strings):
        # Evenly divide between y1 and y2, *including* endpoints
        y = int(np.linspace(y1, y2, num=num_strings)[i])
        cv2.circle(output, (center_x, y), radius=4, color=(0, 0, 255), thickness=-1)

# Show result
cv2.imshow("Roboflow Detection", output)
cv2.waitKey(0)
cv2.destroyAllWindows()
