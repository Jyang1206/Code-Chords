import cv2
import numpy as np
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
from typing import Dict, List, Tuple

API_KEY = "PXAqQENZCRpDPtJ8rd4w"
MODEL_ID = "guitar-frets-segmenter/1"

# Define musical notes and intervals
ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

# Define the open string notes for a standard tuning guitar (from low E to high E)
OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']

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

def draw_scale_notes(frame, polygon, string_idx, fretboard_notes):
    """Draw dots for scale notes on a detected fret."""
    # Determine which fret this is
    # For simplicity, let's assume frets are detected in order from 1 to N
    # We'll use the detection order as a simple fret identification mechanism
    fret_num = string_idx + 1  # This is a simplification - in reality, you'd need more robust fret identification
    
    # Get Y coordinate range of the fret
    y_coords = polygon[:, 1]
    y_min = np.min(y_coords)
    y_max = np.max(y_coords)
    x_center = int(np.mean(polygon[:, 0]))
    
    # Calculate string positions (6 strings)
    y_strings = np.linspace(y_min, y_max, 6, dtype=np.int32)
    
    # For each string
    for string_idx, y_pos in enumerate(y_strings):
        # Get scale note positions for this string
        scale_positions = fretboard_notes.get_string_note_positions(string_idx)
        
        # Check if this fret (string_idx+1) is in the scale positions for this string
        if fret_num in scale_positions:
            # Draw a scale note dot (blue)
            cv2.circle(frame, (x_center, int(y_pos)), 8, (255, 0, 0), -1)
            
            # Get the note name
            note_name = ALL_NOTES[(ALL_NOTES.index(OPEN_STRINGS[string_idx]) + fret_num) % 12]
            
            # Display note name
            cv2.putText(frame, note_name, (x_center + 10, int(y_pos)), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

def custom_sink(predictions: dict, video_frame: VideoFrame, fretboard_notes: FretboardNotes):
    frame = video_frame.image.copy()
    detections = predictions.get("predictions", [])
    
    # Process each detection
    for string_idx, det in enumerate(detections):
        if det.get("class", "") == "Hand" or not det.get("points"):
            continue

        # Get polygon points
        polygon = np.array([[pt["x"], pt["y"]] for pt in det["points"]], dtype=np.int32)
        
        # Draw fret outline in green
        cv2.polylines(frame, [polygon], isClosed=True, color=(0, 255, 0), thickness=2)
        
        # Draw scale notes
        draw_scale_notes(frame, polygon, string_idx, fretboard_notes)

    # Display scale information
    scale_text = f"Scale: {fretboard_notes.selected_root} {fretboard_notes.selected_scale_name}"
    notes_text = f"Notes: {', '.join(fretboard_notes.scale_notes)}"
    
    cv2.putText(frame, scale_text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, notes_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2, cv2.LINE_AA)
    
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
    
    # Available scales for cycling
    available_scales = [
        ('C', 'major'),
        ('A', 'minor'),
        ('G', 'major'),
        ('E', 'minor'),
        ('F', 'major'),
        ('D', 'minor'),
        ('D', 'major'),
    ]
    current_scale_idx = 0
    
    # Create a custom sink function with the fretboard_notes object
    def sink_with_fretboard(predictions: dict, video_frame: VideoFrame):
        return custom_sink(predictions, video_frame, fretboard_notes)
    
    # Initialize the inference pipeline
    pipeline = InferencePipeline.init(
        model_id=MODEL_ID,
        api_key=API_KEY,
        video_reference=0,
        on_prediction=sink_with_fretboard,
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