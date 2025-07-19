"""
Optimized Guitar Processing Module
Core functionality for guitar fret detection and scale visualization
"""

import cv2
import numpy as np
import time
import base64
import tempfile
import os
from typing import Dict, List, Tuple, Optional
from datetime import datetime
from roboflow import Roboflow
from fretDetector import FretTracker, FretboardNotes, VideoFrame, draw_scale_notes
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Musical constants
# ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
# OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']  # 6th to 1st string

# SCALES = {
#     'major': [0, 2, 4, 5, 7, 9, 11],
#     'minor': [0, 2, 3, 5, 7, 8, 10],
#     'pentatonic_major': [0, 2, 4, 7, 9],
#     'pentatonic_minor': [0, 3, 5, 7, 10],
#     'blues': [0, 3, 5, 6, 7, 10],
#     'dorian': [0, 2, 3, 5, 7, 9, 10],
#     'mixolydian': [0, 2, 4, 5, 7, 9, 10],
#     'harmonic_minor': [0, 2, 3, 5, 7, 8, 11],
#     'melodic_minor': [0, 2, 3, 5, 7, 9, 11],
#     'phrygian': [0, 1, 3, 5, 7, 8, 10]
# }

class GuitarProcessor:
    """Main processor for guitar fret detection and visualization."""
    
    def __init__(self):
        # Configuration
        self.API_KEY = os.getenv('API_KEY', "PXAqQENZCRpDPtJ8rd4w")
        self.MODEL_ID = os.getenv('MODEL_ID', "guitar-frets-segmenter/1")
        
        # Image preprocessing settings
        self.target_width = 512
        self.target_height = 384
        self.jpeg_quality = 70
        self.enable_preprocessing = True
        
        # Initialize Roboflow
        self.rf = Roboflow(api_key=self.API_KEY)
        self.model = self._initialize_model()
        
        # Initialize fret tracking objects
        self.fret_tracker = FretTracker(num_frets=12, stability_threshold=0.3)
        self.fretboard_notes = FretboardNotes()
        self.fretboard_notes.set_scale('C', 'major')
        
        # Webcam management
        self.webcam = None
        self.streaming_active = False
    
    def _initialize_model(self):
        """Initialize the Roboflow model with fallback options."""
        try:
            workspace_name = "code-and-chords"
            project_name = "guitar-frets-segmenter"
            version_num = 1
            
            project = self.rf.workspace(workspace_name).project(project_name)
            model = project.version(version_num).model
            print(f"Successfully loaded Roboflow model: {workspace_name}/{project_name}/{version_num}")
            return model
        except Exception as e:
            print(f"Error loading Roboflow model: {str(e)}")
            print("Falling back to default model or will use empty predictions")
            return None
    
    def log_performance(self, step_name, start_time):
        """Log performance timing for a specific step."""
        elapsed = time.time() - start_time
        print(f"⏱️  PERFORMANCE: {step_name} took {elapsed:.3f}s")
        return elapsed
    
    def preprocess_image(self, frame):
        """Optimize image preprocessing for Roboflow."""
        if not self.enable_preprocessing:
            return frame, (frame.shape[1], frame.shape[0]), (frame.shape[1], frame.shape[0])
        
        # Step 1: Resize for optimal processing
        h, w = frame.shape[:2]
        aspect_ratio = w / h
        target_aspect_ratio = self.target_width / self.target_height
        
        if aspect_ratio > target_aspect_ratio:
            new_width = self.target_width
            new_height = int(self.target_width / aspect_ratio)
        else:
            new_height = self.target_height
            new_width = int(self.target_height * aspect_ratio)
        
        resized_frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_AREA)
        
        # Step 2: Apply noise reduction for better detection
        denoised = cv2.fastNlMeansDenoisingColored(resized_frame, None, 10, 10, 7, 21)
        
        # Step 3: Enhance contrast for better fret detection
        lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        
        return enhanced, (new_width, new_height), (w, h)
    
    def process_predictions(self, predictions, original_shape, processed_shape):
        """Process Roboflow predictions and scale back to original size."""
        detections = []
        
        for i, prediction in enumerate(predictions):
            if 'points' in prediction and prediction['points']:
                points = []
                for point in prediction['points']:
                    # Scale points back to original image size
                    original_x = int(point['x'] * original_shape[1] / processed_shape[1])
                    original_y = int(point['y'] * original_shape[0] / processed_shape[0])
                    points.append({
                        'x': original_x,
                        'y': original_y
                    })
                
                # Get fret number from class name
                class_name = prediction.get('class', f'Zone{i+1}')
                try:
                    if class_name.startswith('Zone'):
                        fret_num = int(class_name[4:])
                    else:
                        fret_num = i + 1
                except ValueError:
                    fret_num = i + 1
                
                # Calculate center from scaled points
                x_coords = [p['x'] for p in points]
                y_coords = [p['y'] for p in points]
                x_center = int(sum(x_coords) / len(x_coords))
                y_center = int(sum(y_coords) / len(y_coords))
                
                detection = {
                    'class': class_name,
                    'confidence': prediction.get('confidence', 0.8),
                    'points': points,
                    'x_center': x_center,
                    'y_center': y_center,
                    'fret_num': fret_num
                }
                detections.append(detection)
        
        return detections
    
    def predict_frets(self, frame):
        """Use Roboflow to predict frets in the frame with optimized processing."""
        total_start = time.time()
        print(f"🔍 PERFORMANCE: Starting optimized prediction for frame shape {frame.shape}")
        
        try:
            if self.model is None:
                print("DEBUG: Roboflow model not available, returning empty predictions")
                return []
            
            # Step 1: Optimized image preprocessing
            prep_start = time.time()
            processed_frame, new_shape, original_shape = self.preprocess_image(frame)
            prep_time = self.log_performance("Optimized image preprocessing", prep_start)
            print(f"🔍 PERFORMANCE: Preprocessed from {original_shape} to {new_shape}")
            
            # Step 2: Prepare image for API with connection pooling
            api_prep_start = time.time()
            
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
                # Use optimized encoding parameters
                encode_params = [
                    cv2.IMWRITE_JPEG_QUALITY, self.jpeg_quality,
                    cv2.IMWRITE_JPEG_OPTIMIZE, 1,
                    cv2.IMWRITE_JPEG_PROGRESSIVE, 1
                ]
                _, buffer = cv2.imencode('.jpg', processed_frame, encode_params)
                tmp_file.write(buffer.tobytes())
                tmp_file_path = tmp_file.name
            
            api_prep_time = self.log_performance("API preparation", api_prep_start)
            
            try:
                # Step 3: Roboflow prediction with optimized settings and retry logic
                roboflow_start = time.time()
                print(f"🚀 PERFORMANCE: Sending optimized image ({new_shape[0]}x{new_shape[1]}) to Roboflow...")
                
                # Add retry logic for better reliability
                max_retries = 3
                retry_delay = 0.1
                
                for attempt in range(max_retries):
                    try:
                        predictions = self.model.predict(tmp_file_path, confidence=40).json()
                        break
                    except Exception as e:
                        if attempt < max_retries - 1:
                            print(f"⚠️  Roboflow API attempt {attempt + 1} failed, retrying in {retry_delay}s: {str(e)}")
                            time.sleep(retry_delay)
                            retry_delay *= 2  # Exponential backoff
                        else:
                            raise e
                
                roboflow_time = self.log_performance("Roboflow API call", roboflow_start)
                print(f"📊 PERFORMANCE: Roboflow returned {len(predictions.get('predictions', []))} predictions")
                
                # Step 4: Process predictions with parallel processing for large batches
                process_start = time.time()
                detections = self.process_predictions(predictions.get('predictions', []), original_shape, new_shape)
                process_time = self.log_performance("Prediction processing", process_start)
                
                total_time = self.log_performance("Total optimized prediction", total_start)
                print(f"📈 PERFORMANCE: Optimized breakdown - Preprocess: {prep_time:.3f}s, API Prep: {api_prep_time:.3f}s, Roboflow: {roboflow_time:.3f}s, Process: {process_time:.3f}s, Total: {total_time:.3f}s")
                
                return detections
                
            finally:
                # Clean up temporary file immediately
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)
                    
        except Exception as e:
            print(f"❌ ERROR: Optimized prediction failed after {time.time() - total_start:.3f}s")
            print(f"Error in optimized prediction: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
    
    def custom_sink(self, predictions, video_frame):
        """
        Custom sink function that draws segmentation masks for fret detections
        and adds scale notes to the frets.
        """
        total_start = time.time()
        frame = video_frame.image.copy()
        print(f"🎨 PERFORMANCE: Starting custom_sink for frame shape {frame.shape}")

        # Step 1: Handle predictions
        handle_start = time.time()
        if isinstance(predictions, list):
            detections = predictions
            print(f"DEBUG: Received list of {len(detections)} detections")
        elif isinstance(predictions, dict) and "predictions" in predictions:
            detections = predictions["predictions"]
            print(f"DEBUG: Received dict with {len(detections)} detections")
        else:
            print("DEBUG: No predictions provided")
            detections = []
        
        handle_time = self.log_performance("Prediction handling", handle_start)
        print(f"DEBUG: Processing {len(detections)} detections")

        # Step 2: Update fret tracking
        tracking_start = time.time()
        self.fret_tracker.update(detections, frame.shape[0])
        tracking_time = self.log_performance("Fret tracking update", tracking_start)
        print(f"DEBUG: After update - stable frets: {len(self.fret_tracker.get_stable_frets())}")

        # Step 3: Draw segmentation masks
        drawing_start = time.time()
        print(f"🎨 PERFORMANCE: Starting to draw {len(detections)} detections")
        
        for i, detection in enumerate(detections):
            if "points" in detection and len(detection["points"]) >= 3:
                points = detection["points"]
                print(f"DEBUG: Drawing detection {i} with {len(points)} points")
                
                # Convert points to numpy array for polygon drawing
                polygon_points = np.array([[pt["x"], pt["y"]] for pt in points], dtype=np.int32)
                
                # Ensure points are within frame bounds
                polygon_points[:, 0] = np.clip(polygon_points[:, 0], 0, frame.shape[1] - 1)
                polygon_points[:, 1] = np.clip(polygon_points[:, 1], 0, frame.shape[0] - 1)
                
                # Draw filled polygon (segmentation mask) with semi-transparent overlay
                overlay = frame.copy()
                cv2.fillPoly(overlay, [polygon_points], (0, 255, 0))  # Green fill
                cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)  # Blend with original
                
                # Draw polygon outline
                cv2.polylines(frame, [polygon_points], True, (0, 255, 0), 2)
                
                # Draw fret number
                x_center = detection.get('x_center', int(np.mean([pt["x"] for pt in points])))
                y_center = detection.get('y_center', int(np.mean([pt["y"] for pt in points])))
                cv2.putText(frame, f"Fret {detection.get('fret_num', i+1)}", (x_center - 20, y_center - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                print(f"DEBUG: Drew fret {detection.get('fret_num', i+1)} at ({x_center}, {y_center})")
            else:
                print(f"DEBUG: Detection {i} has insufficient points: {len(detection.get('points', []))}")

        drawing_time = self.log_performance("Segmentation mask drawing", drawing_start)

        # Step 4: Draw scale notes
        notes_start = time.time()
        print("DEBUG: About to call draw_scale_notes")
        self.draw_scale_notes(frame)
        notes_time = self.log_performance("Scale notes drawing", notes_start)
        print("DEBUG: Finished draw_scale_notes")

        # Step 5: Draw debug information
        debug_start = time.time()
        detection_text = f"Detected {len(detections)} frets"
        stable_text = f"Stable frets: {len(self.fret_tracker.get_stable_frets())}"
        cv2.putText(frame, detection_text, (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
        cv2.putText(frame, stable_text, (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2, cv2.LINE_AA)
        debug_time = self.log_performance("Debug text drawing", debug_start)

        total_time = self.log_performance("Total custom_sink processing", total_start)
        print(f"📈 PERFORMANCE: custom_sink breakdown - Handle: {handle_time:.3f}s, Tracking: {tracking_time:.3f}s, Drawing: {drawing_time:.3f}s, Notes: {notes_time:.3f}s, Debug: {debug_time:.3f}s, Total: {total_time:.3f}s")
        
        print("DEBUG: custom_sink returning processed frame")
        return frame
    
    def draw_scale_notes(self, frame):
        """Draw dots for scale notes on detected frets."""
        # Use the imported draw_scale_notes function
        draw_scale_notes(frame, self.fret_tracker, self.fretboard_notes)
    
    def init_webcam(self):
        """Initialize webcam capture."""
        if self.webcam is None:
            self.webcam = cv2.VideoCapture(0)
            if not self.webcam.isOpened():
                print("Error: Could not open webcam")
                return False
            self.webcam.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.webcam.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            self.webcam.set(cv2.CAP_PROP_FPS, 30)
            print("Webcam initialized successfully")
        return True
    
    def release_webcam(self):
        """Release webcam resources."""
        if self.webcam is not None:
            self.webcam.release()
            self.webcam = None
            print("Webcam released")
    
    def process_frame(self, frame):
        """Process a single frame and return the annotated result."""
        video_frame = VideoFrame(image=frame, frame_id=0, frame_timestamp=datetime.now())
        predictions = self.predict_frets(frame)
        processed_frame = self.custom_sink(predictions, video_frame)
        return processed_frame
    
    def change_scale(self, root, scale_type):
        """Change the current scale."""
        self.fretboard_notes.set_scale(root, scale_type)
        return {'status': 'success', 'message': f'Changed scale to {root} {scale_type}'}
    
    def get_frets(self):
        """Get the latest fret data from the tracker."""
        stable_frets = self.fret_tracker.get_stable_frets()
        
        # Convert to serializable format
        fret_data = []
        for x_center, fret in stable_frets.items():
            fret_info = {
                'x_center': int(fret['x_center']),
                'y_center': int(fret['y_center']),
                'fret_num': int(fret['fret_num']),
                'confidence': float(fret['confidence'])
            }
            fret_data.append(fret_info)
        
        return fret_data
    
    def generate_mjpeg_frames(self):
        """Generate MJPEG frames for streaming."""
        if not self.init_webcam():
            return
        
        print("Starting MJPEG stream generation")
        frame_count = 0
        
        while self.streaming_active:
            if self.webcam is None or not self.webcam.isOpened():
                print("Webcam not available, stopping stream")
                break
                
            ret, frame = self.webcam.read()
            if not ret:
                print("Failed to read frame from webcam")
                continue
            
            try:
                # Process the frame
                processed_frame = self.process_frame(frame)
                encode_params = [cv2.IMWRITE_JPEG_QUALITY, 85, cv2.IMWRITE_JPEG_OPTIMIZE, 1]
                _, buffer = cv2.imencode('.jpg', processed_frame, encode_params)
                frame_bytes = buffer.tobytes()
                
                # Yield frame in MJPEG format
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n'
                       b'Content-Length: ' + str(len(frame_bytes)).encode() + b'\r\n'
                       b'\r\n' + frame_bytes + b'\r\n')
                
                frame_count += 1
                if frame_count % 30 == 0:  # Log every 30 frames
                    print(f"Streamed {frame_count} frames")
                
                # Small delay to control frame rate (30 FPS)
                time.sleep(0.033)
                
            except Exception as e:
                print(f"Error processing frame {frame_count}: {str(e)}")
                continue
    
    def start_stream(self):
        """Start the MJPEG stream."""
        self.streaming_active = True
        return {'status': 'success', 'message': 'Stream started'}
    
    def stop_stream(self):
        """Stop the MJPEG stream."""
        self.streaming_active = False
        return {'status': 'success', 'message': 'Stream stopped'}
    
    def test_roboflow(self, img):
        """Test Roboflow prediction with a given image."""
        if self.model is None:
            return {'error': 'Roboflow model not available'}
        
        # Save frame to temporary file for Roboflow
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp_file:
            # Encode frame as JPEG
            _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            tmp_file.write(buffer.tobytes())
            tmp_file_path = tmp_file.name
        
        try:
            # Predict using Roboflow with file path
            predictions = self.model.predict(tmp_file_path, confidence=40).json()
            
            print(f"DEBUG: Raw Roboflow response: {predictions}")
            
            return {
                'status': 'success',
                'raw_predictions': predictions,
                'prediction_count': len(predictions.get('predictions', [])),
                'model_info': {
                    'workspace': 'code-and-chords',
                    'project': 'guitar-frets-segmenter',
                    'version': 1
                }
            }
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path) 