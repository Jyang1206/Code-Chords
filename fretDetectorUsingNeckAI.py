import cv2
import numpy as np
import matplotlib.pyplot as plt
from inference_sdk import InferenceHTTPClient

# Initialize the Roboflow client
client = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key="PXAqQENZCRpDPtJ8rd4w"  # Replace with your actual API key
)

# Path to the input image
image_path = "Photos/PersonStock1.jpg"

# Load the image using OpenCV
image = cv2.imread(image_path)
output = image.copy()

# Run inference using your instance segmentation model
result = client.infer(image_path, model_id="guitar-frets-segmenter/1")  # Replace with your actual model ID

# Extract predictions from the result
detections = result.get("predictions", [])

# Check if any detections are present
if not detections:
    print("No objects detected.")
    exit()

# Iterate over each detection
for det in detections:
    # Extract the polygon points
    points = det.get("points", [])
    if not points:
        continue  # Skip if no polygon points are available

    # Convert points to a NumPy array
    polygon = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.int32)

    # Draw the polygon on the output image
    cv2.polylines(output, [polygon], isClosed=True, color=(0, 255, 0), thickness=2)

    # Optionally, fill the polygon with a transparent overlay
    overlay = output.copy()
    cv2.fillPoly(overlay, [polygon], color=(0, 255, 0))
    alpha = 0.3  # Transparency factor
    cv2.addWeighted(overlay, alpha, output, 1 - alpha, 0, output)

# Display just the image (no border, no title, no axes)
plt.imshow(cv2.cvtColor(output, cv2.COLOR_BGR2RGB))
plt.axis('off')
plt.subplots_adjust(left=0, right=1, top=1, bottom=0)  # remove any padding
plt.margins(0)
plt.gca().xaxis.set_major_locator(plt.NullLocator())
plt.gca().yaxis.set_major_locator(plt.NullLocator())
plt.show()