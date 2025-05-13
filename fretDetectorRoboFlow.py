import cv2
from roboflow import InferencePipeline

API_KEY = "PXAqQENZCRpDPtJ8rd4w"

# Initialize the first pipeline: fretboard detector
pipeline_fretboard = InferencePipeline.init(
    model_id="guitar-fretboard-detector/1",
    api_key=API_KEY,
    on_prediction=None  # We'll handle manually
)

# Initialize the second pipeline: frets segmenter
pipeline_frets = InferencePipeline.init(
    model_id="guitar-frets-segmenter/1",
    api_key=API_KEY,
    on_prediction=None
)

def process_frame(frame):
    # Run fretboard detector
    fretboard_pred = pipeline_fretboard.infer(frame)
    # Typically, you might want to crop or mask based on predictions
    # For simplicity, we'll use the image output as-is
    # If your model returns a visualization, use 'image'
    stage1_vis = fretboard_pred.get('image', frame)
    
    # Run frets segmenter on the result
    frets_pred = pipeline_frets.infer(stage1_vis)
    # Get visualization for display (or handle predictions as needed)
    stage2_vis = frets_pred.get('image', stage1_vis)
    return stage2_vis, frets_pred

# Open webcam
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    vis_frame, predictions = process_frame(frame)
    cv2.imshow('Fretboard & Frets Detection', vis_frame)

    # Press 'q' to quit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()