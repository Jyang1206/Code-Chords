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
image_path = "Photos/AcousticStock1.jpg"

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

    if det.get("class", []) == "Hand": #IF HAND
        # Draw the polygon on the output image
        cv2.polylines(output, [polygon], isClosed=True, color=(255, 255, 0), thickness=2)
        overlay = output.copy()
        cv2.fillPoly(overlay, [polygon], color=(255, 75, 0))
        alpha = 0.3  # Transparency factor
        cv2.addWeighted(overlay, alpha, output, 1 - alpha, 0, output)
        continue

    # Optionally, fill the polygon with a transparent overlay
    overlay = output.copy()
    cv2.fillPoly(overlay, [polygon], color=(0, 255, 0))
    alpha = 0.3  # Transparency factor
    cv2.addWeighted(overlay, alpha, output, 1 - alpha, 0, output)

    # Compute vertical line for string dots inside polygon
    # We'll get the top and bottom middle of the bounding box
    
    x_vals = [p["x"] for p in det["points"]]
    y_vals = [p["y"] for p in det["points"]]

    min_x, max_x = min(x_vals), max(x_vals)
    min_y, max_y = min(y_vals), max(y_vals)

    # Estimate left and right edge of the fret (string axis)
    top_center = (min_x + max_x) / 2, min(y_vals)
    bottom_center = (min_x + max_x) / 2, max(y_vals)

    # Draw 6 dots evenly spaced along the vertical center
    for s in range(6):
        alpha = s / 5  # spacing between 0 and 1
        dot_x = top_center[0] * (1 - alpha) + bottom_center[0] * alpha
        dot_y = top_center[1] * (1 - alpha) + bottom_center[1] * alpha
        cv2.circle(output, (int(dot_x), int(dot_y)), radius=3, color=(50, 50, 255), thickness=-1)


# Display just the image (no border, no title, no axes)
plt.imshow(cv2.cvtColor(output, cv2.COLOR_BGR2RGB))
plt.axis('off')
plt.subplots_adjust(left=0, right=1, top=1, bottom=0)  # remove any padding
plt.margins(0)
plt.gca().xaxis.set_major_locator(plt.NullLocator())
plt.gca().yaxis.set_major_locator(plt.NullLocator())
plt.show()