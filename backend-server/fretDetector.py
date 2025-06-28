import cv2
import numpy as np
import mediapipe as mp
from inference import InferencePipeline
from inference.core.interfaces.camera.entities import VideoFrame
from typing import Dict, List, Tuple, Optional
import time

API_KEY = "PXAqQENZCRpDPtJ8rd4w"
MODEL_ID = "guitar-frets-segmenter/1"

# def all musical notes
ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

# open strings of guitar
OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']  # from 6th string(top) to 1st string(bottom)

# scale defns & intervals
SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],          
    'minor': [0, 2, 3, 5, 7, 8, 10],          
    'pentatonic_major': [0, 2, 4, 7, 9],      
    'pentatonic_minor': [0, 3, 5, 7, 10],     
    'blues': [0, 3, 5, 6, 7, 10],             
    'dorian': [0, 2, 3, 5, 7, 9, 10],         
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],     
    'harmonic_minor': [0, 2, 3, 5, 7, 8, 11], 
    'melodic_minor': [0, 2, 3, 5, 7, 9, 11],  
    'phrygian': [0, 1, 3, 5, 7, 8, 10]        
}

class FretboardNotes:
    def __init__(self, num_frets: int = 22):
        self.selected_scale_name = 'major'  # default scale
        self.selected_root = 'C'            # Default root note
        self.scale_notes = self._calculate_scale_notes()
        self.num_frets = num_frets

    def _calculate_scale_notes(self) -> List[str]:
        root_index = ALL_NOTES.index(self.selected_root)
        scale_intervals = SCALES[self.selected_scale_name]
        return [ALL_NOTES[(root_index + interval) % 12] for interval in scale_intervals]

    def set_scale(self, root: str, scale_name: str) -> None:
        if root in ALL_NOTES and scale_name in SCALES:
            self.selected_root = root
            self.selected_scale_name = scale_name
            self.scale_notes = self._calculate_scale_notes()
            print(f"Scale set to {root} {scale_name}: {', '.join(self.scale_notes)}")
        else:
            print(f"Invalid scale parameters. Root must be in {ALL_NOTES} and scale in {list(SCALES.keys())}")

    def get_fretboard_map(self, num_frets: int = None) -> Dict[int, List[str]]:
        if num_frets is None:
            num_frets = self.num_frets
        fretboard = {}
        for string_idx, open_note in enumerate(OPEN_STRINGS):
            string_notes = []
            open_note_idx = ALL_NOTES.index(open_note)
            for fret in range(num_frets, 0, -1):  # 22 (rightmost) to 1 (leftmost)
                note_idx = (open_note_idx + fret) % 12
                string_notes.append(ALL_NOTES[note_idx])
            fretboard[string_idx] = string_notes
        return fretboard

    def is_note_in_scale(self, note: str) -> bool:
        return note in self.scale_notes

    def get_string_note_positions(self, string_idx: int, num_frets: int = None) -> List[int]:
        if num_frets is None:
            num_frets = self.num_frets
        if string_idx < 0 or string_idx >= len(OPEN_STRINGS):
            return []
        positions = []
        open_note = OPEN_STRINGS[string_idx]
        open_note_idx = ALL_NOTES.index(open_note)
        for fret in range(num_frets, 0, -1):  # 22 (rightmost) to 1 (leftmost)
            note_idx = (open_note_idx + fret) % 12
            note = ALL_NOTES[note_idx]
            if self.is_note_in_scale(note):
                positions.append(fret)  # 22=rightmost, 1=leftmost
        return positions

    def get_note_at_position(self, string_idx: int, fret_num: int) -> str:
        if string_idx < 0 or string_idx >= len(OPEN_STRINGS):
            return ''
        open_note = OPEN_STRINGS[string_idx]
        open_note_idx = ALL_NOTES.index(open_note)
        note_idx = (open_note_idx + fret_num) % 12  # 22=rightmost, 1=leftmost
        return ALL_NOTES[note_idx]

class NeckTracker:
    def update(self, detections, frame_height): #detections from a guitar neck detector
        self.frame_height = frame_height
        # 1st pass: collect all detections
        for det in detections:
            if not det.get("points"):
                continue
                
            class_name = det.get("class", "")
            if not class_name == "neck":
                continue
                
            polygon = np.array([[pt["x"], pt["y"]] for pt in det["points"]], dtype=np.int32)
            if len(polygon) < 3:
                continue
                
            x_coords = polygon[:, 0]
            y_coords = polygon[:, 1]
            x_center = int(np.mean(x_coords))
            y_center = int(np.mean(y_coords))
            
                
            # Store neck data
            current_neck = {
                'x_center': x_center,
                'y_center': y_center,
                'y_min': np.min(y_coords),
                'y_max': np.max(y_coords),
            }

class FretTracker:
    def __init__(self, num_frets=12, stability_threshold=0.3):
        self.frets = {}  # dict to store fret positions
        self.fret_history = {}  # store past positions for stability
        self.confidence_history = {}  # store confidence scores history
        self.history_max_size = 45  
        self.num_frets = num_frets
        self.stability_threshold = stability_threshold
        self.last_update_time = time.time()
        self.update_interval = 0.033  # 30fps
        self.sorted_frets = []  # sorted list of fret positions
        self.frame_height = 0
        self.debug_mode = True
        self.min_fret_width = 20
        self.min_fret_spacing = 40  # minimum pixels between adjacent frets
        self.max_fret_spacing = 120  # maximum pixels between adjacent frets

    def update(self, detections, frame_height):
        """Update fret tracking with new detections."""
        self.frame_height = frame_height
        current_time = time.time()
        
        if current_time - self.last_update_time < self.update_interval:
            return
            
        self.last_update_time = current_time
        
        current_frets = {}
        
        # 1st pass: collect all detections
        for det in detections:
            if not det.get("points"):
                continue
                
            ##print(det)
            class_name = det.get("class", "")
            ##if class_name == "Hand" or not class_name.startswith("fret"):
            if class_name == "Hand" or not class_name.startswith("Zone"):
                ##print("entered")
                continue
                
            # get fret number
            try:
                fret_num = int(class_name[4:])  # Extract number after "Zone"
            except ValueError:
                continue
                
            if fret_num < 1 or fret_num > self.num_frets:
                continue
                
            # check confidence threshold
            confidence = det.get("confidence", 0)
            if confidence < self.stability_threshold:
                continue
                
            polygon = np.array([[pt["x"], pt["y"]] for pt in det["points"]], dtype=np.int32)
            if len(polygon) < 3:
                continue
                
            x_coords = polygon[:, 0]
            y_coords = polygon[:, 1]
            x_center = int(np.mean(x_coords))
            y_center = int(np.mean(y_coords))
            
            # basic width validation
            fret_width = np.max(x_coords) - np.min(x_coords)
            if fret_width < self.min_fret_width:
                continue
                
            # Store basic fret data
            current_frets[x_center] = {
                'x_center': x_center,
                'y_center': y_center,
                'y_min': np.min(y_coords),
                'y_max': np.max(y_coords),
                'width': fret_width,
                'fret_num': fret_num,
                'confidence': confidence
            }
        
        # 2nd pass: validate spacing between frets (for optimisation purposes)
        sorted_frets = sorted(current_frets.items(), key=lambda x: x[1]['x_center'])
        valid_frets = {}
        
        for i, (x_center, fret_data) in enumerate(sorted_frets):
            is_valid = True
            
            # Check spacing with previous fret
            if i > 0:
                prev_x = sorted_frets[i-1][1]['x_center']
                spacing = x_center - prev_x
                if spacing < self.min_fret_spacing or spacing > self.max_fret_spacing:
                    is_valid = False
            
            if is_valid:
                valid_frets[x_center] = fret_data
        
        self.frets = valid_frets
        self.sorted_frets = sorted(self.frets.items(), key=lambda x: x[1]['x_center'])

    def get_string_positions(self, fret_data):
        """Calculate positions of strings on this fret."""
        y_min = fret_data['y_min']
        y_max = fret_data['y_max']
        total_height = y_max - y_min
        
        # calc 6 evenly spaced string positions
        string_positions = []
        for i in range(6):
            pos = y_min + (i * total_height / 5)
            string_positions.append(int(pos))
            
        return string_positions

    def get_stable_frets(self):
        """Return all valid frets."""
        return self.frets
