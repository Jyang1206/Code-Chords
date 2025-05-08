from ultralytics import YOLO
from inference
import cv2

# Initialize client with your Roboflow publishable API key
client = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key="rf_4thZISN7GDaeTAh9u4gd7HSi1AP2"  # Replace with your real key if needed
)

# Run inference on your image
result = client.infer(
    image="Photos/PersonStock1.jpg",  # Adjust path as needed
    model_id="guitar-necks-detector/1"
)

# Print detection results
print(result)

# Load the model (ensure yolov10n.pt is downloaded or replace with yolov8n.pt etc.)
model = YOLO("yolov8m.pt")  # Or "yolov8n.pt" if using YOLOv8

# Load image
image_path = "Photos/AcousticStock1.jpg"  # Replace with your actual image path
image = cv2.imread(image_path)

# Run inference
results = model.predict(source=image, conf=0.1, save=False, verbose=False)

# Draw bounding boxes
for result in results:
    for box in result.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])  # Box coordinates
        cls_id = int(box.cls[0])               # Class ID
        label = model.names[cls_id]            # Class name

        # Draw rectangle and label
        cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(image, label, (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

# Show result
cv2.imshow("Detected Objects", image)
cv2.waitKey(0)
cv2.destroyAllWindows()
