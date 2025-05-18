import asyncio
from fastapi import FastAPI, Response, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import threading
from typing import AsyncGenerator, Optional, Union, Dict, Any
from contextlib import asynccontextmanager
import uvicorn
import time
import os
import argparse
from datetime import datetime
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
import fretDetectorCMajorScale as fdcm
from inference_sdk import InferenceHTTPClient

# Import the server manager utilities
try:
    from server_manager import check_port_in_use, free_port
    server_manager_available = True
except ImportError:
    server_manager_available = False
    print("Warning: server_manager module not found, port management disabled")

# Parse command line arguments
def parse_args():
    parser = argparse.ArgumentParser(description='Guitar Fretboard Detection Server')
    parser.add_argument('--port', type=int, default=8000, help='Port to run the server on')
    parser.add_argument('--free-port', action='store_true', help='Free the port if it is in use')
    parser.add_argument('--camera', type=int, default=0, help='Camera index to use')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    return parser.parse_args()


# Global variables for processed frames
latest_processed_frame = None
frame_lock = threading.Lock()


def custom_sink(predictions: dict, video_frame: VideoFrame, fretboard_notes: fdcm.FretboardNotes, fret_tracker: fdcm.FretTracker):
    """
    Custom sink function that processes frames from the pipeline.
    This is called by the InferencePipeline when a frame is processed.
    """
    global latest_processed_frame, frame_lock
    
    try:
        # Get a copy of the frame
        frame = video_frame.image.copy()
        
        # Draw raw detections from the model
        detections = predictions.get("predictions", [])
        has_detections = len(detections) > 0
        
        # Only draw detection count - minimize text overlay
        if has_detections:
            # Create a small semi-transparent background for text
            cv2.rectangle(frame, (5, 70), (200, 100), (0, 0, 0), -1)
            cv2.putText(frame, f"Detections: {len(detections)}", 
                      (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 1)
        
        # Process each detection - only draw outlines
        for i, det in enumerate(detections):
            if not det.get("points"):
                continue
            
            polygon = np.array([[pt["x"], pt["y"]] for pt in det["points"]], dtype=np.int32)
            class_name = det.get("class", "Unknown")
            
            # Draw only the polygon outline - no labels for better performance
            if class_name == "Hand":
                cv2.polylines(frame, [polygon], True, (0, 255, 255), 2)
            elif class_name.startswith("Zone"):
                cv2.polylines(frame, [polygon], True, (0, 255, 0), 2)
        
        # Update fret tracker with the predictions
        if has_detections:
            fret_tracker.update(detections, frame.shape[0])
            print(f"Got {len(detections)} predictions")
        
        # Get stable frets from the tracker
        stable_frets = fret_tracker.get_stable_frets()
        
        # Only proceed if we have actual fret detections
        if stable_frets:
            # Determine the fretboard area from stable frets
            fret_positions = []
            min_y = frame.shape[0]
            max_y = 0
            
            # Collect fret positions and determine vertical bounds
            for _, fret_data in stable_frets.items():
                fret_positions.append((fret_data['x_center'], fret_data['fret_num']))
                min_y = min(min_y, fret_data['y_min'])
                max_y = max(max_y, fret_data['y_max'])
            
            # Sort frets by position
            fret_positions.sort(key=lambda x: x[0])
            
            # Only proceed if we have at least 2 frets detected
            if len(fret_positions) >= 2:
                # Calculate string positions
                string_margin = max(0, min_y - 20)
                string_height = (max_y - min_y) / 5  # For 6 strings
                
                # Draw strings only between detected frets
                left_x = fret_positions[0][0] - 20
                right_x = fret_positions[-1][0] + 20
                
                # Draw strings
                for i in range(6):  # 6 strings
                    string_y = int(string_margin + i * string_height)
                    cv2.line(frame, (left_x, string_y), (right_x, string_y), (255, 0, 0), 2)
                    
                    # Label string number - minimal text
                    string_num = 6 - i  # Convert to standard numbering
                    cv2.putText(frame, f"{string_num}", (left_x - 15, string_y + 5), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 1)
                
                # Draw fret numbers and highlight scale notes
                for x_pos, fret_num in fret_positions:
                    # Draw fret number at top
                    cv2.putText(frame, f"{fret_num}", (x_pos - 5, string_margin - 10), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
                    
                    # Highlight scale notes on each string
                    for string_idx in range(6):
                        string_y = int(string_margin + string_idx * string_height)
                        
                        # Get scale note positions for this string
                        scale_positions = fretboard_notes.get_string_note_positions(string_idx, 24)
                        
                        # Check if this fret position is in the scale
                        if fret_num in scale_positions:
                            # Calculate note name at this position
                            note_name = fretboard_notes.get_note_at_position(string_idx, fret_num)
                            
                            # Draw scale note dot
                            if note_name == fretboard_notes.selected_root:
                                # Root note - yellow
                                cv2.circle(frame, (x_pos, string_y), 10, (0, 255, 255), -1)
                            else:
                                # Other scale note - blue
                                cv2.circle(frame, (x_pos, string_y), 10, (255, 0, 0), -1)
                            
                            # Add note name with minimal background
                            text_size = cv2.getTextSize(note_name, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                            cv2.rectangle(frame, 
                                        (x_pos - text_size[0]//2 - 1, string_y - text_size[1]//2 - 1),
                                        (x_pos + text_size[0]//2 + 1, string_y + text_size[1]//2 + 1),
                                        (0, 0, 0), -1)
                            cv2.putText(frame, note_name, 
                                      (x_pos - text_size[0]//2, string_y + text_size[1]//2), 
                                      cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                
                # Add minimal scale info at bottom
                scale_text = f"{fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}"
                cv2.rectangle(frame, (5, frame.shape[0] - 25), 
                             (len(scale_text) * 10 + 10, frame.shape[0] - 5), (0, 0, 0), -1)
                cv2.putText(frame, scale_text, (10, frame.shape[0] - 10), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        
        # Add detection status
        detection_status = f"{len(detections)} detections"
        cv2.putText(frame, detection_status, 
                   (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)
        
        # Add timestamp
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        cv2.putText(frame, f"Time: {timestamp}", 
                   (frame.shape[1] - 150, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
        
        # Update the latest processed frame
        with frame_lock:
            latest_processed_frame = frame
        
        # Return None as required by the sink function
        return None
        
    except Exception as e:
        print(f"Error in custom_sink: {str(e)}")
        # On error, just return None
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    """
    # Initialize fretboard notes and tracker
    global fretboard_notes, fret_tracker, pipeline, camera
    
    print("Initializing fretboard notes and tracker...")
    fretboard_notes = fdcm.FretboardNotes()
    fretboard_notes.set_scale('C', 'major')
    fret_tracker = fdcm.FretTracker(num_frets=12, stability_threshold=0.3)
    
    # Initialize the camera
    camera_index = args.camera if 'args' in globals() else 0
    camera = Camera(camera_index)
    
    # Create a wrapper for the custom_sink function that includes fretboard_notes and fret_tracker
    def sink_with_objects(predictions: dict, video_frame: VideoFrame):
        return custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
    
    # Initialize the inference pipeline
    print("Initializing inference pipeline...")
    pipeline = InferencePipeline.init(
        model_id=fdcm.MODEL_ID,
        api_key=fdcm.API_KEY,
        video_reference=camera_index,  # Use camera index directly
        on_prediction=sink_with_objects,  # Use our wrapped sink function
    )
    
    # Start the pipeline
    print("Starting inference pipeline...")
    pipeline.start()
    
    try:
        yield
    except asyncio.exceptions.CancelledError as error:
        print(error.args)
    finally:
        camera.release()
        if pipeline:
            pipeline.stop()  # Use stop method as in fretDetectorCMajorScale.py
        print("Camera and pipeline resources released.")


app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Global variables
fretboard_notes = None
fret_tracker = None
pipeline = None
pipeline_lock = threading.Lock()
use_debug_mode = False

# Create screenshots directory if it doesn't exist
SCREENSHOTS_DIR = "screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


class Camera:
    """
    A class to handle video capture from a camera.
    """

    def __init__(self, url: Optional[Union[str, int]] = 0) -> None:
        """
        Initialize the camera.

        :param url: Camera URL or index.
        """
        self.cap = cv2.VideoCapture(url)
        self.lock = threading.Lock()
        self.frame_count = 0
        self.last_frame = None
        self.frame_skip = 2  # Process every nth frame for better performance
        
        # Try to set camera resolution for better performance - lower resolution
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    def get_frame(self) -> bytes:
        """
        Capture a frame from the camera.

        :return: Frame as numpy array or empty bytes if capture failed.
        """
        with self.lock:
            ret, frame = self.cap.read()
            if not ret:
                return b''
                
            self.frame_count += 1
            self.last_frame = frame
            return frame

    def get_processed_frame(self) -> bytes:
        """
        Get the latest processed frame or capture and process a new frame.

        :return: JPEG encoded processed image bytes.
        """
        global latest_processed_frame
        
        try:
            # Get a new frame from the camera
            frame = self.get_frame()
            if isinstance(frame, bytes):
                return frame  # Return empty bytes if capture failed
            
            # The pipeline processes frames automatically through the video_reference
            # We just need to check if we have a processed frame available
            with frame_lock:
                if latest_processed_frame is not None:
                    processed_frame = latest_processed_frame.copy()
                else:
                    # If no processed frame is available yet, use the raw frame
                    processed_frame = frame
            
            # Encode to JPEG with lower quality for better performance
            ret, jpeg = cv2.imencode('.jpg', processed_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if not ret:
                return b''
                
            return jpeg.tobytes()
            
        except Exception as e:
            print(f"Error in get_processed_frame: {str(e)}")
            # Return the original frame if processing fails
            if isinstance(frame, np.ndarray):
                ret, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if not ret:
                    return b''
                return jpeg.tobytes()
            return b''

    def release(self) -> None:
        """
        Release the camera resource.
        """
        with self.lock:
            if self.cap.isOpened():
                self.cap.release()


async def gen_frames() -> AsyncGenerator[bytes, None]:
    """
    An asynchronous generator function that yields camera frames.

    :yield: JPEG encoded image bytes.
    """
    try:
        frame_interval = 0.05  # 50ms between frames (20fps max)
        last_frame_time = 0
        
        while True:
            current_time = time.time()
            
            # Rate limit frame generation
            if current_time - last_frame_time < frame_interval:
                await asyncio.sleep(0.01)  # Small delay to prevent CPU overload
                continue
                
            # Get and yield the frame
            frame = camera.get_processed_frame()
            if frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                last_frame_time = current_time
            else:
                break
                
            # Sleep a bit to give other tasks a chance to run
            await asyncio.sleep(0.01)
    except (asyncio.CancelledError, GeneratorExit):
        print("Frame generation cancelled.")
    finally:
        print("Frame generator exited.")


@app.get("/video")
async def video_feed() -> StreamingResponse:
    """
    Video streaming route with fret detection.

    :return: StreamingResponse with multipart JPEG frames.
    """
    return StreamingResponse(
        gen_frames(),
        media_type='multipart/x-mixed-replace; boundary=frame'
    )


@app.get("/snapshot")
async def snapshot() -> Response:
    """
    Snapshot route to get a single processed frame.

    :return: Response with JPEG image.
    """
    frame = camera.get_processed_frame()
    if frame:
        return Response(content=frame, media_type="image/jpeg")
    else:
        return Response(status_code=404, content="Camera frame not available.")


@app.post("/change_scale")
async def change_scale(request: Request) -> Dict[str, Any]:
    """
    Change the scale for fretboard visualization.
    
    :param request: Request object containing scale data.
    :return: Success status and scale information.
    """
    global fretboard_notes
    
    try:
        data = await request.json()
        root = data.get('root', 'C')
        scale_type = data.get('scale', 'major')
        
        if root in fdcm.ALL_NOTES:
            fretboard_notes.set_scale(root, scale_type)
            return {
                'success': True,
                'scale': f'{root} {scale_type}'
            }
        else:
            return {
                'success': False,
                'error': 'Invalid root note'
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


@app.get("/toggle_debug")
async def toggle_debug() -> Dict[str, Any]:
    """
    Toggle debug visualization mode.
    
    :return: Current debug mode status.
    """
    global use_debug_mode
    use_debug_mode = not use_debug_mode
    return {"debug_mode": use_debug_mode}


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint.
    
    :return: Server status information.
    """
    global fretboard_notes, fret_tracker
    
    return {
        'status': 'healthy',
        'message': 'Server is running',
        'debug_mode': use_debug_mode,
        'frame_count': camera.frame_count,
        'scale': f"{fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}",
        'fret_count': fret_tracker.num_frets
    }


@app.get("/reinitialize")
async def reinitialize_pipeline() -> Dict[str, Any]:
    """
    Reinitialize the inference pipeline.
    
    :return: Success status and error message if applicable.
    """
    global pipeline, fretboard_notes, fret_tracker
    
    try:
        # Reset fretboard notes and tracker
        print("Reinitializing fretboard notes and tracker...")
        fretboard_notes = fdcm.FretboardNotes()
        fretboard_notes.set_scale('C', 'major')
        fret_tracker = fdcm.FretTracker(num_frets=12, stability_threshold=0.3)
        
        # Note: We don't actually need to reinitialize the pipeline
        # since we're not using pipeline.process_frame
        print("Reinitialization complete")
        return {
            'success': True,
            'message': 'Reinitialized successfully'
        }
    except Exception as e:
        print(f"Error reinitializing: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


@app.get("/save_screenshot")
async def save_screenshot() -> Dict[str, Any]:
    """
    Save a screenshot of the current processed frame.
    
    :return: Success status and filename.
    """
    try:
        # Get processed frame
        frame = camera.get_processed_frame()
        if not frame:
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "No frame available"}
            )
        
        # Decode JPEG to numpy array
        nparr = np.frombuffer(frame, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        scale_info = f"{fretboard_notes.selected_root}_{fretboard_notes.selected_scale_name}"
        filename = f"fretboard_{scale_info}_{timestamp}.jpg"
        filepath = os.path.join(SCREENSHOTS_DIR, filename)
        
        # Save the image
        cv2.imwrite(filepath, img)
        
        return {
            "success": True,
            "filename": filename,
            "path": filepath,
            "scale": f"{fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}"
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )


@app.post("/set_fret_count")
async def set_fret_count(request: Request) -> Dict[str, Any]:
    """
    Set the number of frets to display.
    
    :param request: Request object containing fret count data.
    :return: Success status and fret count information.
    """
    global fret_tracker
    
    try:
        data = await request.json()
        fret_count = data.get('fret_count', 12)
        
        # Validate fret count (between 1 and 24)
        fret_count = max(1, min(24, fret_count))
        
        # Update fret tracker
        fret_tracker.num_frets = fret_count
        
        return {
            'success': True,
            'fret_count': fret_count
        }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


async def main():
    """
    Main entry point to run the Uvicorn server.
    """
    # Try multiple ports in case of conflicts
    ports = [8000, 8001, 8002, 8003]
    
    for port in ports:
        try:
            print(f"Attempting to start server on port {port}...")
            config = uvicorn.Config(app, host='0.0.0.0', port=port)
            server = uvicorn.Server(config)
            
            # Update the frontend URL in the console for easy access
            print(f"\n✅ Server starting! Access the frontend at:")
            print(f"   http://localhost:{port}/video - For direct video stream")
            print(f"   Open website-frontend/streaming.html in your browser (update the port to {port})\n")
            
            # Run the server
            await server.serve()
            break  # If successful, exit the loop
        except OSError as e:
            if "address already in use" in str(e).lower() or "only one usage" in str(e).lower():
                print(f"Port {port} is already in use, trying next port...")
                if port == ports[-1]:
                    print("All ports are in use. Please close other applications or specify a different port.")
                    return
            else:
                print(f"Error starting server: {e}")
                return


if __name__ == '__main__':
    # Parse command line arguments
    args = parse_args()
    
    # Update global settings from command line
    use_debug_mode = args.debug
    
    # Check if the port is in use and free it if requested
    if server_manager_available and args.free_port:
        if check_port_in_use(args.port):
            print(f"Port {args.port} is in use. Attempting to free it...")
            if free_port(args.port):
                print(f"Successfully freed port {args.port}")
            else:
                print(f"Failed to free port {args.port}. Trying alternative ports...")
    
    # Initialize the camera
    camera = Camera(args.camera)  # Use camera index from command line args

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped by user.") 