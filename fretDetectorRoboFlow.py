import cv2
import numpy as np
from inference import get_model  # Direct single-model API
from collections import defaultdict

# Replace with your actual API key and model IDs
API_KEY_FRETBOARD_MODEL = "tNGaAGE5IufNanaTpyG3"
API_KEY_FRETS_MODEL = "PXAqQENZCRpDPtJ8rd4w"
FRETBOARD_MODEL_ID = "guitar-fretboard-detector/1"
FRETS_MODEL_ID = "guitar-frets-segmenter/1"

previous_polygons = defaultdict(list)
ALPHA = 0.8

def custom_sink(predictions: list, frame: np.ndarray):
    for det in predictions:
        det_id = det.get("detection_id")
        label = det.get("class", "")
        points = det.get("points", [])

        if not points or det_id is None:
            continue

        current_poly = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.float32)

        if previous_polygons[det_id]:
            prev_poly = np.array(previous_polygons[det_id], dtype=np.float32)
            smoothed_poly = ALPHA * prev_poly + (1 - ALPHA) * current_poly
        else:
            smoothed_poly = current_poly

        previous_polygons[det_id] = smoothed_poly

        polygon = smoothed_poly.astype(np.int32)
        outline_color = (0, 255, 0)
        fill_color = tuple(np.random.randint(100, 255, 3).tolist())

        overlay = frame.copy()
        cv2.fillPoly(overlay, [polygon], color=fill_color)
        cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
        cv2.polylines(frame, [polygon], isClosed=True, color=outline_color, thickness=2)

        if len(polygon) >= 4:
            sorted_y = sorted(polygon, key=lambda p: p[1])
            top_edge = sorted_y[:2]
            bottom_edge = sorted_y[-2:]
            top_avg = np.mean(top_edge, axis=0)
            bottom_avg = np.mean(bottom_edge, axis=0)

            for s in range(6):
                alpha = s / 5.0
                dot = (1 - alpha) * top_avg + alpha * bottom_avg
                cv2.circle(frame, tuple(dot.astype(int)), 3, (0, 0, 255), -1)

    cv2.imshow("Guitar Frets Detection", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        cv2.destroyAllWindows()
        exit()

def main():
    # Load models
    fretboard_model = get_model(FRETBOARD_MODEL_ID, api_key=API_KEY_FRETBOARD_MODEL)
    frets_model = get_model(FRETS_MODEL_ID, api_key=API_KEY_FRETS_MODEL)

    # Video capture (0 is your webcam; change if needed)
    cap = cv2.VideoCapture(0)

    while True:
        fretboard_model = get_model(FRETBOARD_MODEL_ID, api_key=API_KEY_FRETBOARD_MODEL)
        frets_model = get_model(FRETS_MODEL_ID, api_key=API_KEY_FRETS_MODEL)
        cap = cv2.VideoCapture(0)  # <-- USE WEBCAM

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            fretboard_result = fretboard_model.predict(frame)
            frets_result = frets_model.predict(frame)
            frets_predictions = frets_result.get("predictions", [])

            custom_sink(frets_predictions, frame)


    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()