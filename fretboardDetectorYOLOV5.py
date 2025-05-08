import cv2
from ultralytics import YOLO
import numpy as np
import matplotlib.pyplot as plt

# Load the YOLOv8 model
model = YOLO('yolov8n.pt')
model.train(data='guitar.yaml', epochs=50, imgsz=640)


# track guitars in a video file
results = model.track(
    source='path/to/your_guitar_video.mp4',
    tracker='bytetrack.yaml',  # or botsort.yaml, etc.
    conf=0.3,
    classes=[0]                # only the “guitar” class
)