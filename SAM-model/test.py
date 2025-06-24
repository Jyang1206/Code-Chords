from ultralytics import SAM
import cv2

# Load a model
model = SAM("sam_b.pt")

# Display model information (optional)
model.info()

# Run inference
model("../Photos/AcousticStock1.jpg")