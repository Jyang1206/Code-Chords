import cv2
import numpy as np
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
from typing import Dict, List, Tuple, Optional
import time

API_KEY = "PXAqQENZCRpDPtJ8rd4w"
MODEL_ID = "guitar-frets-segmenter/1"

# Define musical notes and intervals
ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

# Define the open string notes for a standard tuning guitar (from 6th string to 1st string)
OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']  # Order matches standard guitar string numbering

# Scale definitions (intervals from the root note)
SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],          # Whole, Whole, Half, Whole, Whole, Whole, Half
    'minor': [0, 2, 3, 5, 7, 8, 10],          # Whole, Half, Whole, Whole, Half, Whole, Whole
    'pentatonic_major': [0, 2, 4, 7, 9],      # Major without 4th and 7th
    'pentatonic_minor': [0, 3, 5, 7, 10],     # Minor without 2nd and 6th
    'blues': [0, 3, 5, 6, 7, 10]              # Pentatonic minor with blue note
}

class FretboardNotes:
    def __init__(self):
        self.selected_scale_name = 'major'  # Default scale
        self.selected_root = 'C'            # Default root note
        self.scale_notes = self._calculate_scale_notes()
        
    def _calculate_scale_notes(self) -> List[str]:
        """Calculate notes in the currently selected scale."""
        root_index = ALL_NOTES.index(self.selected_root)
        scale_intervals = SCALES[self.selected_scale_name]
        
        return [ALL_NOTES[(root_index + interval) % 12] for interval in scale_intervals]
    
    def set_scale(self, root: str, scale_name: str) -> None:
        """Set a new scale by root note and scale type."""
        if root in ALL_NOTES and scale_name in SCALES:
            self.selected_root = root
            self.selected_scale_name = scale_name
            self.scale_notes = self._calculate_scale_notes()
            print(f"Scale set to {root} {scale_name}: {', '.join(self.scale_notes)}")
        else:
            print(f"Invalid scale parameters. Root must be in {ALL_NOTES} and scale in {list(SCALES.keys())}")
    
    def get_fretboard_map(self, num_frets: int = 12) -> Dict[int, List[str]]:
        """Generate a mapping of string index to notes at each fret position."""
        fretboard = {}
        
        for string_idx, open_note in enumerate(OPEN_STRINGS):
            string_notes = []
            open_note_idx = ALL_NOTES.index(open_note)
            
            for fret in range(num_frets + 1):  # Include open string (fret 0)
                note_idx = (open_note_idx + fret) % 12
                string_notes.append(ALL_NOTES[note_idx])
            
            fretboard[string_idx] = string_notes
            
        return fretboard
    
    def is_note_in_scale(self, note: str) -> bool:
        """Check if a note is in the currently selected scale."""
        return note in self.scale_notes
    
    def get_string_note_positions(self, string_idx: int, num_frets: int = 12) -> List[int]:
        """Get fret positions where notes in the scale appear on a specific string."""
        if string_idx < 0 or string_idx >= len(OPEN_STRINGS):
            return []
        
        positions = []
        open_note = OPEN_STRINGS[string_idx]
        open_note_idx = ALL_NOTES.index(open_note)
        
        for fret in range(num_frets + 1):
            note_idx = (open_note_idx + fret) % 12
            note = ALL_NOTES[note_idx]
            
            if self.is_note_in_scale(note):
                positions.append(fret)
                
        return positions

    def get_note_at_position(self, string_idx: int, fret_num: int) -> str:
        """Get the note name at a specific string and fret position."""
        if string_idx < 0 or string_idx >= len(OPEN_STRINGS):
            return ''
            
        open_note = OPEN_STRINGS[string_idx]
        open_note_idx = ALL_NOTES.index(open_note)
        note_idx = (open_note_idx + fret_num) % 12
        return ALL_NOTES[note_idx]

class FretTracker:
    def __init__(self, num_frets=12, stability_threshold=0.3):
        self.frets = {}  # Dictionary to store fret positions
        self.fret_history = {}  # Store past positions for stability
        self.history_max_size = 10  # Increased history for better stability
        self.num_frets = num_frets
        self.stability_threshold = stability_threshold
        self.last_update_time = time.time()
        self.update_interval = 0.033  # 30fps
        self.sorted_frets = []  # Sorted list of fret positions
        self.frame_height = 0
        self.debug_mode = True
        self.min_fret_width = 20
        self.smoothing_factor = 0.9
        self.position_history = {}
        self.fret_numbers = {}
        self.last_stable_assignment = None
        self.stable_frames_required = 15
        
    def get_fret_number_from_class(self, class_name):
        """Extract fret number from zone class name."""
        if class_name.startswith("Zone"):
            try:
                return int(class_name[4:])  # Extract number after "Zone"
            except ValueError:
                return -1
        return -1
        
    def update(self, detections, frame_height):
        """Update fret tracking with new detections."""
        self.frame_height = frame_height
        current_time = time.time()
        
        if current_time - self.last_update_time < self.update_interval:
            return
            
        self.last_update_time = current_time
        
        # Process each detection
        current_frets = {}
        for det in detections:
            if not det.get("points"):
                continue
                
            class_name = det.get("class", "")
            if class_name == "Hand" or not class_name.startswith("Zone"):
                continue
                
            # Get fret number from class name
            fret_num = self.get_fret_number_from_class(class_name)
            if fret_num < 1 or fret_num > self.num_frets:
                continue
                
            polygon = np.array([[pt["x"], pt["y"]] for pt in det["points"]], dtype=np.int32)
            
            if len(polygon) < 3:
                continue
                
            x_coords = polygon[:, 0]
            fret_width = np.max(x_coords) - np.min(x_coords)
            
            if fret_width < self.min_fret_width:
                continue
                
            x_center = int(np.mean(polygon[:, 0]))
            y_center = int(np.mean(polygon[:, 1]))
            
            # Basic fret data with class information
            fret_data = {
                'polygon': polygon,
                'x_center': x_center,
                'y_center': y_center,
                'y_min': np.min(polygon[:, 1]),
                'y_max': np.max(polygon[:, 1]),
                'width': fret_width,
                'fret_num': fret_num,
                'confidence': det.get("confidence", 0)
            }
            
            # Apply smoothing
            smoothed_data = self.smooth_position(x_center, fret_data)
            current_frets[x_center] = smoothed_data
        
        # Update history and cleanup old frets
        frets_to_remove = []
        for x_center in list(self.frets.keys()):
            if x_center in current_frets:
                if x_center not in self.fret_history:
                    self.fret_history[x_center] = []
                    
                self.fret_history[x_center].append(current_frets[x_center])
                if len(self.fret_history[x_center]) > self.history_max_size:
                    self.fret_history[x_center].pop(0)
            else:
                if len(self.fret_history.get(x_center, [])) < self.stable_frames_required:
                    frets_to_remove.append(x_center)
                    if x_center in self.position_history:
                        del self.position_history[x_center]
        
        # Remove old frets
        for x_center in frets_to_remove:
            if x_center in self.frets:
                del self.frets[x_center]
            if x_center in self.fret_history:
                del self.fret_history[x_center]
        
        # Update current frets
        self.frets = current_frets
        
        # Sort frets by their actual fret numbers from zone classification
        self.sorted_frets = sorted(
            self.frets.items(),
            key=lambda x: x[1]['fret_num']
        )
    
    def get_fret_number(self, x_center):
        """Get the fret number for a position."""
        if x_center in self.frets:
            return self.frets[x_center]['fret_num']
        return -1
    
    def get_stable_frets(self):
        """Return frets that have been detected consistently."""
        stable_frets = {}
        
        for x_center, fret_data in self.frets.items():
            # Only include frets that have sufficient history
            if len(self.fret_history.get(x_center, [])) >= self.stable_frames_required:
                stable_frets[x_center] = fret_data
                
        return stable_frets

    def smooth_position(self, x_center, fret_data):
        """Apply exponential smoothing to fret positions."""
        if x_center not in self.position_history:
            self.position_history[x_center] = {
                'x': x_center,
                'y': fret_data['y_center'],
                'y_min': fret_data['y_min'],
                'y_max': fret_data['y_max']
            }
            return fret_data
            
        # Apply smoothing to all position components
        alpha = self.smoothing_factor
        hist = self.position_history[x_center]
        
        # Smooth the positions
        smoothed_x = alpha * hist['x'] + (1 - alpha) * x_center
        smoothed_y = alpha * hist['y'] + (1 - alpha) * fret_data['y_center']
        smoothed_y_min = alpha * hist['y_min'] + (1 - alpha) * fret_data['y_min']
        smoothed_y_max = alpha * hist['y_max'] + (1 - alpha) * fret_data['y_max']
        
        # Update history
        self.position_history[x_center] = {
            'x': smoothed_x,
            'y': smoothed_y,
            'y_min': smoothed_y_min,
            'y_max': smoothed_y_max
        }
        
        # Create smoothed fret data
        smoothed_data = fret_data.copy()
        smoothed_data['x_center'] = int(smoothed_x)
        smoothed_data['y_center'] = int(smoothed_y)
        smoothed_data['y_min'] = int(smoothed_y_min)
        smoothed_data['y_max'] = int(smoothed_y_max)
        
        # Update polygon points with smoothed positions
        if 'polygon' in smoothed_data:
            polygon = smoothed_data['polygon'].copy()
            # Adjust polygon points based on smoothed center
            dx = int(smoothed_x) - int(x_center)
            dy = int(smoothed_y) - fret_data['y_center']
            polygon[:, 0] += dx
            polygon[:, 1] += dy
            smoothed_data['polygon'] = polygon
            
        return smoothed_data

    def get_string_positions(self, fret_data):
        """Calculate positions of strings on this fret (6th string to 1st string)."""
        y_min = fret_data['y_min']
        y_max = fret_data['y_max']
        fret_height = y_max - y_min
        
        # If fret area is too small, estimate using frame height
        if fret_height < 30 and self.frame_height > 0:
            y_min = max(0, y_min - fret_data['width'])
            y_max = min(self.frame_height, y_max + fret_data['width'])
            
        # Calculate 6 string positions (6th string to 1st string, top to bottom)
        return np.linspace(y_min, y_max, 6, dtype=np.int32)

def draw_scale_notes(frame, fret_tracker, fretboard_notes):
    """Draw dots for scale notes on detected frets using tracking for stability."""
    stable_frets = fret_tracker.get_stable_frets()
    
    # Draw debug info
    if fret_tracker.debug_mode:
        cv2.putText(frame, f"Active frets: {len(stable_frets)}", 
                   (10, frame.shape[0] - 30), cv2.FONT_HERSHEY_SIMPLEX, 
                   0.5, (255, 255, 255), 1, cv2.LINE_AA)
    
    # Process frets in order of their assigned numbers
    for x_center, fret_data in fret_tracker.sorted_frets:
        fret_num = fret_data['fret_num']  # Use the fret number from zone classification
        if fret_num < 1:
            continue
        
        # Draw fret outline with varying colors based on stability
        history_len = len(fret_tracker.fret_history.get(x_center, []))
        stability_color = (0, 255, 0) if history_len >= fret_tracker.stable_frames_required else (0, 255, 255)
        cv2.polylines(frame, [fret_data['polygon']], isClosed=True, 
                     color=stability_color, thickness=2)
        
        # Draw fret number with background
        label = f"Fret {fret_num}"
        (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(frame, 
                     (fret_data['x_center'] - text_w//2 - 2, fret_data['y_min'] - text_h - 6),
                     (fret_data['x_center'] + text_w//2 + 2, fret_data['y_min'] - 2),
                     stability_color, -1)
        cv2.putText(frame, label,
                   (fret_data['x_center'] - text_w//2, fret_data['y_min'] - 4),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
        
        # Calculate string positions (6th string to 1st string)
        string_positions = fret_tracker.get_string_positions(fret_data)
        
        # Draw dots for each string if the note is in the scale
        for string_idx, y_pos in enumerate(string_positions):
            # Get scale note positions for this string
            scale_positions = fretboard_notes.get_string_note_positions(string_idx)
            
            # Calculate note name at this position
            note_name = fretboard_notes.get_note_at_position(string_idx, fret_num)
            
            # Check if this fret position is in the scale
            if fret_num in scale_positions:
                # Draw scale note dot with shadow for depth
                if note_name == fretboard_notes.selected_root:
                    # Root note - yellow with orange shadow
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 10, (0, 128, 255), -1)
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 8, (0, 255, 255), -1)
                else:
                    # Other scale note - blue with darker shadow
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 10, (128, 0, 0), -1)
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 8, (255, 0, 0), -1)
                
                # Display note name with background for better visibility
                (text_w, text_h), _ = cv2.getTextSize(note_name, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(frame,
                            (fret_data['x_center'] + 6, int(y_pos) - text_h//2 - 2),
                            (fret_data['x_center'] + text_w + 10, int(y_pos) + text_h//2 + 2),
                            (0, 0, 0), -1)
                cv2.putText(frame, note_name,
                           (fret_data['x_center'] + 8, int(y_pos) + text_h//2),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
                
                # Add string number for clarity
                string_num = 6 - string_idx  # Convert to standard string numbering
                cv2.putText(frame, f"({string_num})",
                           (fret_data['x_center'] - 25, int(y_pos) + 4),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (128, 128, 128), 1, cv2.LINE_AA)
            else:
                # Draw small gray dots for notes not in scale
                cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 4, (128, 128, 128), -1)

def custom_sink(predictions: dict, video_frame: VideoFrame, fretboard_notes: FretboardNotes, fret_tracker: FretTracker):
    frame = video_frame.image.copy()
    detections = predictions.get("predictions", [])
    
    # Display raw detection data for debugging
    detection_text = f"Raw detections: {len(detections)}"
    cv2.putText(frame, detection_text, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 1, cv2.LINE_AA)
    
    # Draw all raw detections in red for debugging
    for i, det in enumerate(detections):
        if not det.get("points"):
            continue
        
        polygon = np.array([[pt["x"], pt["y"]] for pt in det["points"]], dtype=np.int32)
        class_name = det.get("class", "Unknown")
        confidence = det.get("confidence", 0)
        
        # Draw all detected polygons in red (raw detections)
        cv2.polylines(frame, [polygon], isClosed=True, color=(0, 0, 255), thickness=1)
        
        # Add detection info
        x_pos = int(np.mean(polygon[:, 0]))
        y_pos = int(np.min(polygon[:, 1]) - 10)
        cv2.putText(frame, f"{class_name} ({confidence:.2f})", 
                   (x_pos, y_pos), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1, cv2.LINE_AA)
    
    # Update fret tracking with new detections
    fret_tracker.update(detections, frame.shape[0])
    
    # Get stable fret positions
    stable_frets = fret_tracker.get_stable_frets()
    
    # Draw fret outlines for stable detections in green
    for x_center, fret_data in stable_frets.items():
        # Draw fret outline in green
        cv2.polylines(frame, [fret_data['polygon']], isClosed=True, color=(0, 255, 0), thickness=2)
    
    # Draw scale notes on the stable frets
    draw_scale_notes(frame, fret_tracker, fretboard_notes)

    # Display scale information
    scale_text = f"Scale: {fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}"
    notes_text = f"Notes: {', '.join(fretboard_notes.scale_notes)}"
    
    cv2.putText(frame, scale_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, notes_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
    
    # Display active frets
    fret_info = f"Active frets: {len(stable_frets)}"
    cv2.putText(frame, fret_info, (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 1, cv2.LINE_AA)
    
    # Display keyboard controls
    cv2.putText(frame, "Press 'q' to quit, 's' to change scale", (10, frame.shape[0] - 10), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    
    cv2.imshow("Guitar Scale Detector", frame)
    key = cv2.waitKey(1) & 0xFF
    
    # Return keyboard input for main program to handle
    return key

def main():
    # Initialize the fretboard notes with C major scale
    fretboard_notes = FretboardNotes()
    fretboard_notes.set_scale('C', 'major')
    
    # Initialize fret tracker with more permissive settings
    fret_tracker = FretTracker(num_frets=12, stability_threshold=0.3)
    
    # Available scales for cycling
    available_scales = [
        ('C', 'major'),
        ('A', 'minor'),
        ('G', 'major'),
        ('E', 'minor'),
        ('F', 'major'),
        ('D', 'minor'),
        ('D', 'major'),
        ('E', 'pentatonic_minor'),
        ('A', 'pentatonic_minor'),
        ('G', 'pentatonic_major'),
    ]
    current_scale_idx = 0
    
    # Create a custom sink function with the fretboard_notes object
    def sink_with_objects(predictions: dict, video_frame: VideoFrame):
        return custom_sink(predictions, video_frame, fretboard_notes, fret_tracker)
    
    # Initialize the inference pipeline without preprocessing_params
    pipeline = InferencePipeline.init(
        model_id=MODEL_ID,
        api_key=API_KEY,
        video_reference=0,
        on_prediction=sink_with_objects,
    )
    
    # Start the pipeline
    pipeline.start()
    
    # Main loop to handle keyboard input
    try:
        while True:
            # Check for keyboard input returned from custom_sink
            key = cv2.waitKey(100) & 0xFF
            
            if key == ord('q'):
                break
            elif key == ord('s'):
                # Cycle to the next scale
                current_scale_idx = (current_scale_idx + 1) % len(available_scales)
                root, scale_type = available_scales[current_scale_idx]
                fretboard_notes.set_scale(root, scale_type)
                
    except KeyboardInterrupt:
        pass
    finally:
        # Stop the pipeline and close windows
        pipeline.stop()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()