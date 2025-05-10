import cv2
import numpy as np
import matplotlib.pyplot as plt
from inference_sdk import InferenceHTTPClient

# Initialize Roboflow client
client = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key="PXAqQENZCRpDPtJ8rd4w"  # Replace with your actual API key
)

# Load image
image_path = "Photos/PersonStock1.jpg"
image = cv2.imread(image_path)
output = image.copy()

# Run inference
result = client.infer(image_path, model_id="guitar-necks-detector/1")
detections = result.get("predictions", [])

if not detections:
    print("No guitar neck detected.")
    exit()

# Use the first detection (assumed neck)
det = detections[0]
x, y, w, h = det["x"], det["y"], det["width"], det["height"]

# Construct polygon from detection (assumes axis-aligned for now)
top_left     = np.array([x - w / 2, y - h / 2])
top_right    = np.array([x + w / 2, y - h / 2])
bottom_right = np.array([x + w / 2, y + h / 2])
bottom_left  = np.array([x - w / 2, y + h / 2])
neck_polygon = np.array([top_left, top_right, bottom_right, bottom_left], dtype=np.float32)

# Draw green bounding box (thinner line)
cv2.polylines(output, [neck_polygon.astype(np.int32)], isClosed=True, color=(0, 255, 0), thickness=1)

# Compute top and bottom neck edges
top_edge = neck_polygon[1] - neck_polygon[0]
bottom_edge = neck_polygon[2] - neck_polygon[3]

# Use fret ratios (skip open string area)
def get_fret_ratios(num_frets=12):
    return [(1 - 1 / (2 ** (n / 12))) for n in range(1, num_frets + 1)]

ratios = get_fret_ratios()
fret_positions = []

# Interpolate fret lines from fret 1 onward
for ratio in ratios:
    top_pt = neck_polygon[0] + top_edge * ratio
    bottom_pt = neck_polygon[3] + bottom_edge * ratio
    fret_positions.append((top_pt, bottom_pt))

# Draw each fret + string dots
for idx, (top, bottom) in enumerate(fret_positions, start=1):
    top = top.astype(np.int32)
    bottom = bottom.astype(np.int32)

    # Fret line
    cv2.line(output, tuple(top), tuple(bottom), (255, 255, 0), 1)

    # 6 red string dots from top to bottom
    for s in range(6):
        alpha = s / 5
        dot = (1 - alpha) * top + alpha * bottom
        cv2.circle(output, tuple(dot.astype(np.int32)), 3, (0, 0, 255), -1)

# Display result
plt.figure(figsize=(12, 6))
plt.imshow(cv2.cvtColor(output, cv2.COLOR_BGR2RGB))
plt.title("Fret Positions with String Dots (from Fret 1)")
plt.axis('off')
plt.show()