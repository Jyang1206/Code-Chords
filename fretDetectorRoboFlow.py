import cv2
from inference import InferencePipeline
from inference.core.interfaces.stream.sinks import render_boxes

API_KEY     = "tNGaAGE5IufNanaTpyG3"
WORKSPACE   = "guitar-detection-thbw0"
WORKFLOW_ID = "guitar-fretboarddetection-v1"      # the composite workflow you just created

def draw_everything(result, video_frame):
    frame = video_frame.image.copy()
    # 1) Draw any polygons (from your segmenter block)
    for det in result.get("segmenter_predictions", []):
        pts = det["points"]
        poly = [(p["x"], p["y"]) for p in pts]
        cv2.polylines(frame, [np.array(poly, np.int32)], True, (0,255,0), 2)
    # 2) Draw any boxes (from your detector block)
    render_boxes(frame, result.get("detector_predictions", []))
    cv2.imshow("All Models Chained", frame)
    if cv2.waitKey(1) & 0xFF == ord("q"):
        pipeline.terminate()

pipeline = InferencePipeline.init_with_workflow(
    api_key=API_KEY,
    workspace_name=WORKSPACE,
    workflow_id=WORKFLOW_ID,
    video_reference=0,        # your webcam
    on_prediction=draw_everything
)

pipeline.start()
pipeline.join()
