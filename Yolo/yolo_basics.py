from ultralytics import YOLO
import cv2 
import numpy as np

model = YOLO('yolov8n.pt')  # Load the YOLOv8 model

detection_output = model.predict(source= "Photos" , conf=0.25, show=True)  # Perform detection on a video file

print(detection_output)  # Print the detection results

print(detection_output[0].numpy())  # Print the numpy array of the first detection result

