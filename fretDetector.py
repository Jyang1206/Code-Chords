import cv2
import numpy as np
import mediapipe as mp
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
        self.confidence_history = {}  # Store confidence scores history
        self.history_max_size = 15  # Increased history for better stability
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
        self.fret_numbers = {}  # Store stable fret numbers
        self.fret_number_history = {}  # Track fret number history
        self.fret_number_counts = {}  # Count frequency of fret numbers at positions
        self.stable_frames_required = 30  # Significantly increased for more stability
        self.max_history_frames = 90  # Increased for longer history
        self.min_spacing = 30  # Minimum pixels between fret centers
        self.last_valid_fretboard = None  # Store last valid fretboard boundaries
        self.last_stable_positions = {}  # Store last stable positions for each fret
        self.position_change_threshold = 35  # Reduced maximum allowed position change
        self.consecutive_changes_required = 25  # Significantly increased
        self.fret_probation = {}  # Track potential fret changes during probation
        self.probation_frames = 30  # Significantly increased probation period
        self.last_stable_time = {}  # Track when each fret was last stable
        self.min_stable_time = 1.0  # Increased to 1 second minimum
        self.stability_scores = {}  # Track stability scores for each fret
        self.confidence_decay = 0.98  # Slower decay for more stability
        self.min_confidence_for_change = 0.9  # Very high confidence requirement
        self.stability_threshold_for_change = 0.8  # Higher stability requirement
        self.super_stable_frets = {}  # Track frets that have been stable for a long time
        self.super_stable_time = 2.0  # Time required for super-stable state
        self.super_stable_confidence = 0.95  # Confidence needed to change super-stable frets
        
    def get_fret_number_from_class(self, class_name):
        """Extract fret number from zone class name."""
        if class_name.startswith("Zone"):
            try:
                return int(class_name[4:])  # Extract number after "Zone"
            except ValueError:
                return -1
        return -1
        
    def update_stability_score(self, x_center, fret_num, confidence):
        """Update stability score for a fret based on consistency and confidence."""
        if x_center not in self.stability_scores:
            self.stability_scores[x_center] = {'score': 0.3, 'last_fret': fret_num}  # Start with lower initial score
            
        stability_data = self.stability_scores[x_center]
        
        # Apply slower confidence decay
        stability_data['score'] *= self.confidence_decay
        
        # Increase score if same fret, decrease if different
        if fret_num == stability_data['last_fret']:
            # Smaller increases for more conservative scoring
            increase = 0.05 * confidence
            stability_data['score'] = min(1.0, stability_data['score'] + increase)
        else:
            # Larger decreases for changes
            decrease = 0.3 * (1 - confidence)
            stability_data['score'] = max(0.0, stability_data['score'] - decrease)
            
        stability_data['last_fret'] = fret_num
        return stability_data['score']
        
    def validate_fret_number(self, x_center, fret_num, confidence):
        """Validate fret number using historical data and physical constraints with enhanced stability."""
        current_time = time.time()
        
        # Initialize history if needed
        if x_center not in self.fret_number_history:
            self.fret_number_history[x_center] = []
            self.fret_number_counts[x_center] = {}
            self.last_stable_time[x_center] = current_time
            
        # Check super-stable state
        if x_center in self.super_stable_frets:
            super_stable_fret = self.super_stable_frets[x_center]
            if fret_num != super_stable_fret:
                # Require extremely high confidence and stability to change super-stable frets
                if confidence < self.super_stable_confidence:
                    return super_stable_fret
                # Reset super-stable state if very high confidence different detection
                else:
                    del self.super_stable_frets[x_center]
            
        # Update stability score
        stability_score = self.update_stability_score(x_center, fret_num, confidence)
            
        # Check minimum stable time requirement with dynamic threshold
        if x_center in self.fret_numbers:
            time_since_stable = current_time - self.last_stable_time.get(x_center, 0)
            
            # Check for super-stable qualification
            if (time_since_stable > self.super_stable_time and 
                stability_score > 0.9 and 
                x_center not in self.super_stable_frets):
                self.super_stable_frets[x_center] = self.fret_numbers[x_center]
            
            # Increased minimum time for lower stability scores
            min_time_required = self.min_stable_time * (1 + (1 - stability_score) * 2)
            if time_since_stable < min_time_required:
                return self.fret_numbers[x_center]
            
        # Check for physically impossible position changes
        if x_center in self.last_stable_positions:
            last_pos = self.last_stable_positions[x_center]
            # More restrictive position changes based on stability
            max_allowed_change = self.position_change_threshold * (stability_score ** 2)
            if abs(x_center - last_pos) > max_allowed_change:
                return self.fret_numbers.get(x_center, fret_num)
            
        # Update history with more weight on confidence
        self.fret_number_history[x_center].append((fret_num, confidence))
        if len(self.fret_number_history[x_center]) > self.max_history_frames:
            self.fret_number_history[x_center].pop(0)
            
        # If we have a stable fret number, require very strong evidence to change it
        if x_center in self.fret_numbers:
            current_stable = self.fret_numbers[x_center]
            if fret_num != current_stable:
                # Require higher stability for changes
                if stability_score < self.stability_threshold_for_change:
                    return current_stable
                    
                # Check if this potential change is already in probation
                if x_center not in self.fret_probation:
                    self.fret_probation[x_center] = {
                        'fret': fret_num,
                        'frames': 0,
                        'high_conf_frames': 0,
                        'total_confidence': 0,
                        'avg_confidence': 0,
                        'consecutive_high_conf': 0  # Track consecutive high confidence detections
                    }
                elif self.fret_probation[x_center]['fret'] != fret_num:
                    # Reset probation if the proposed change is different
                    self.fret_probation[x_center] = {
                        'fret': fret_num,
                        'frames': 0,
                        'high_conf_frames': 0,
                        'total_confidence': 0,
                        'avg_confidence': 0,
                        'consecutive_high_conf': 0
                    }
                
                # Update probation counters with enhanced tracking
                prob_data = self.fret_probation[x_center]
                prob_data['frames'] += 1
                prob_data['total_confidence'] += confidence
                prob_data['avg_confidence'] = prob_data['total_confidence'] / prob_data['frames']
                
                # Track consecutive high confidence detections
                if confidence > self.min_confidence_for_change:
                    prob_data['high_conf_frames'] += 1
                    prob_data['consecutive_high_conf'] += 1
                else:
                    prob_data['consecutive_high_conf'] = 0  # Reset consecutive counter
                
                # Check if change meets enhanced probation requirements
                if (prob_data['frames'] >= self.probation_frames and 
                    prob_data['high_conf_frames'] >= self.consecutive_changes_required and
                    prob_data['avg_confidence'] > self.min_confidence_for_change and
                    prob_data['consecutive_high_conf'] >= 10):  # Require 10 consecutive high confidence frames
                    # Probation passed, allow the change
                    del self.fret_probation[x_center]
                else:
                    # Still in probation, maintain current number
                    return current_stable
                
        # Get high confidence history with dynamic threshold
        conf_threshold = max(0.75, self.min_confidence_for_change * (1 - stability_score * 0.5))
        high_conf_history = [(num, conf) for num, conf in self.fret_number_history[x_center] 
                           if conf > conf_threshold]
        
        if high_conf_history:
            counts = {}
            total_confidence = {}
            
            # Weight counts by confidence and recency with stronger recency bias
            for idx, (num, conf) in enumerate(high_conf_history):
                # Stronger recency weight
                recency_weight = ((idx + 1) / len(high_conf_history)) ** 2  # Square for stronger recent bias
                weighted_conf = conf * (0.3 + 0.7 * recency_weight)  # More weight on recency
                
                counts[num] = counts.get(num, 0) + 1
                total_confidence[num] = total_confidence.get(num, 0) + weighted_conf
                
            # Find the number with highest confidence-weighted count
            weighted_counts = {num: count * (total_confidence[num] / count) 
                             for num, count in counts.items()}
            
            most_common = max(weighted_counts.items(), key=lambda x: x[1])
            
            # Require stronger agreement for changes based on stability
            agreement_threshold = 0.85 * (1 + (1 - stability_score) * 0.3)  # Higher base threshold
            if most_common[1] >= len(high_conf_history) * agreement_threshold:
                validated_num = most_common[0]
                # Update stable position and time
                self.last_stable_positions[x_center] = x_center
                self.last_stable_time[x_center] = current_time
                return validated_num
                
        return self.fret_numbers.get(x_center, fret_num)
        
    def validate_fretboard_bounds(self, detections):
        """Calculate and validate fretboard boundaries."""
        if not detections:
            return self.last_valid_fretboard if self.last_valid_fretboard else None
            
        # Get all valid zone detections
        valid_zones = [det for det in detections 
                      if det.get("points") and 
                      det.get("class", "").startswith("Zone") and
                      len(det["points"]) >= 3]
        
        if not valid_zones:
            return self.last_valid_fretboard if self.last_valid_fretboard else None
            
        # Calculate overall bounds
        all_points = np.array([[pt["x"], pt["y"]] for det in valid_zones for pt in det["points"]])
        x_min, y_min = np.min(all_points, axis=0)
        x_max, y_max = np.max(all_points, axis=0)
        
        # Add margins
        margin = self.min_fret_width
        bounds = {
            'x_min': max(0, x_min - margin),
            'x_max': x_max + margin,
            'y_min': max(0, y_min - margin),
            'y_max': min(self.frame_height, y_max + margin)
        }
        
        # Validate bounds
        if bounds['x_max'] - bounds['x_min'] > 50 and bounds['y_max'] - bounds['y_min'] > 50:
            self.last_valid_fretboard = bounds
            return bounds
            
        return self.last_valid_fretboard if self.last_valid_fretboard else None
        
    def remove_overlapping_frets(self, current_frets):
        """Remove overlapping fret detections, keeping the ones with higher confidence."""
        if not current_frets:
            return {}
            
        # Sort frets by confidence
        sorted_centers = sorted(current_frets.items(), 
                              key=lambda x: (-x[1]['confidence'], x[1]['fret_num']))
        
        # Keep track of valid frets
        valid_frets = {}
        used_positions = set()
        
        for x_center, fret_data in sorted_centers:
            # Check if this fret overlaps with any existing fret
            is_valid = True
            fret_x = fret_data['x_center']
            
            for existing_x in used_positions:
                if abs(existing_x - fret_x) < self.min_spacing:
                    is_valid = False
                    break
            
            if is_valid:
                valid_frets[x_center] = fret_data
                used_positions.add(fret_x)
        
        return valid_frets
        
    def update(self, detections, frame_height):
        """Update fret tracking with new detections."""
        self.frame_height = frame_height
        current_time = time.time()
        
        if current_time - self.last_update_time < self.update_interval:
            return
            
        self.last_update_time = current_time
        
        # Validate fretboard boundaries
        fretboard_bounds = self.validate_fretboard_bounds(detections)
        if not fretboard_bounds:
            return
        
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
            y_coords = polygon[:, 1]
            x_center = int(np.mean(x_coords))
            y_center = int(np.mean(y_coords))
            
            # Check if detection is within fretboard bounds with more tolerance
            margin = self.min_fret_width * 1.5
            if (x_center < fretboard_bounds['x_min'] - margin or 
                x_center > fretboard_bounds['x_max'] + margin or
                y_center < fretboard_bounds['y_min'] - margin or
                y_center > fretboard_bounds['y_max'] + margin):
                continue
                
            fret_width = np.max(x_coords) - np.min(x_coords)
            if fret_width < self.min_fret_width:
                continue
                
            confidence = det.get("confidence", 0)
            
            # Validate fret number using history and physical constraints
            validated_fret_num = self.validate_fret_number(x_center, fret_num, confidence)
            
            # Store validated fret number if confidence is high
            if confidence > 0.5:
                self.fret_numbers[x_center] = validated_fret_num
            
            # Basic fret data with validated number
            fret_data = {
                'polygon': polygon,
                'x_center': x_center,
                'y_center': y_center,
                'y_min': np.min(y_coords),
                'y_max': np.max(y_coords),
                'width': fret_width,
                'fret_num': validated_fret_num,
                'confidence': confidence,
                'interpolated': False
            }
            
            # Apply smoothing
            smoothed_data = self.smooth_position(x_center, fret_data)
            current_frets[x_center] = smoothed_data
        
        # Remove overlapping detections
        current_frets = self.remove_overlapping_frets(current_frets)
        
        # Clean up old history
        current_positions = set(current_frets.keys())
        for x_center in list(self.fret_number_history.keys()):
            if x_center not in current_positions:
                if len(self.fret_number_history[x_center]) < self.stable_frames_required:
                    del self.fret_number_history[x_center]
                    if x_center in self.fret_number_counts:
                        del self.fret_number_counts[x_center]
                    if x_center in self.fret_numbers:
                        del self.fret_numbers[x_center]
                    if x_center in self.position_history:
                        del self.position_history[x_center]
        
        # Update frets and sort
        self.frets = current_frets
        self.sorted_frets = sorted(
            self.frets.items(),
            key=lambda x: x[1]['x_center']  # Sort by x position for consistent display
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
        """Apply exponential smoothing to fret positions with enhanced stability."""
        if x_center not in self.position_history:
            self.position_history[x_center] = {
                'x': x_center,
                'y': fret_data['y_center'],
                'y_min': fret_data['y_min'],
                'y_max': fret_data['y_max'],
                'width': fret_data['width']
            }
            return fret_data
            
        # Use even stronger smoothing for more stability
        alpha = 0.03  # Reduced further for even smoother transitions
        hist = self.position_history[x_center]
        
        # Apply stricter position change limits
        max_change = self.position_change_threshold * 0.5  # Half the threshold for smoother movement
        new_x = max(min(x_center, hist['x'] + max_change), hist['x'] - max_change)
        
        # Smooth all position components with change limits
        smoothed_x = alpha * new_x + (1 - alpha) * hist['x']
        smoothed_y = alpha * fret_data['y_center'] + (1 - alpha) * hist['y']
        smoothed_y_min = alpha * fret_data['y_min'] + (1 - alpha) * hist['y_min']
        smoothed_y_max = alpha * fret_data['y_max'] + (1 - alpha) * hist['y_max']
        smoothed_width = alpha * fret_data['width'] + (1 - alpha) * hist['width']
        
        # Update history
        self.position_history[x_center] = {
            'x': smoothed_x,
            'y': smoothed_y,
            'y_min': smoothed_y_min,
            'y_max': smoothed_y_max,
            'width': smoothed_width
        }
        
        # Create smoothed data with rounding for extra stability
        smoothed_data = fret_data.copy()
        smoothed_data['x_center'] = round(smoothed_x)
        smoothed_data['y_center'] = round(smoothed_y)
        smoothed_data['y_min'] = round(smoothed_y_min)
        smoothed_data['y_max'] = round(smoothed_y_max)
        smoothed_data['width'] = round(smoothed_width)
        
        return smoothed_data

    def get_string_positions(self, fret_data):
        """Calculate positions of strings on this fret with improved stability."""
        y_min = fret_data['y_min']
        y_max = fret_data['y_max']
        fret_height = y_max - y_min
        
        # Use frame height to estimate string spacing if fret area is too small
        if fret_height < 50 and self.frame_height > 0:
            # Expand the detection area while maintaining center
            center_y = (y_min + y_max) / 2
            desired_height = max(100, fret_height * 1.5)  # At least 100 pixels or 1.5x current height
            y_min = center_y - desired_height / 2
            y_max = center_y + desired_height / 2
            
            # Ensure bounds are within frame
            y_min = max(0, y_min)
            y_max = min(self.frame_height, y_max)
            
        # Calculate string spacing with padding
        total_height = y_max - y_min
        string_padding = total_height * 0.1  # 10% padding
        usable_height = total_height - 2 * string_padding
        
        # Calculate 6 string positions with padding (6th string to 1st string, top to bottom)
        string_positions = []
        for i in range(6):
            pos = y_min + string_padding + (i * usable_height / 5)
            string_positions.append(int(pos))
            
        return string_positions

def draw_scale_notes(frame, fret_tracker, fretboard_notes):
    """Draw dots for scale notes on detected frets using tracking for stability."""
    stable_frets = fret_tracker.get_stable_frets()
    
    # Draw debug info
    if fret_tracker.debug_mode:
        cv2.putText(frame, f"Active frets: {len(stable_frets)}", 
                   (10, frame.shape[0] - 30), cv2.FONT_HERSHEY_SIMPLEX, 
                   0.5, (255, 255, 255), 1, cv2.LINE_AA)
    
    # Get highest confidence fret for reference
    max_confidence = max((fret['confidence'] for fret in stable_frets.values()), default=0)
    confidence_threshold = max_confidence * 0.3
    
    # Process frets in order of confidence (highest to lowest)
    for x_center, fret_data in fret_tracker.sorted_frets:
        if fret_data['confidence'] < confidence_threshold:
            continue
            
        fret_num = fret_data['fret_num']
        if fret_num < 1:
            continue
        
        # Calculate string positions (6th string to 1st string)
        string_positions = fret_tracker.get_string_positions(fret_data)
        
        # Draw fret number label at the top
        label_color = (255, 255, 255) if not fret_data.get('interpolated', False) else (128, 128, 255)
        cv2.putText(frame, f"Fret {fret_num}", 
                   (fret_data['x_center'] - 20, int(string_positions[0]) - 20),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, label_color, 1, cv2.LINE_AA)
        
        # Draw dots for each string if the note is in the scale
        for string_idx, y_pos in enumerate(string_positions):
            scale_positions = fretboard_notes.get_string_note_positions(string_idx)
            note_name = fretboard_notes.get_note_at_position(string_idx, fret_num)
            
            if fret_num in scale_positions:
                if note_name == fretboard_notes.selected_root:
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 10, (0, 128, 255), -1)
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 8, (0, 255, 255), -1)
                else:
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 10, (0, 0, 128), -1)
                    cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 8, (0, 0, 255), -1)
                
                # Display note name with consistent positioning
                (text_w, text_h), _ = cv2.getTextSize(note_name, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                text_x = fret_data['x_center'] + 12  # Consistent offset
                text_y = int(y_pos) + text_h//2
                
                # Background rectangle for better visibility
                cv2.rectangle(frame,
                            (text_x - 2, text_y - text_h - 2),
                            (text_x + text_w + 2, text_y + 2),
                            (0, 0, 0), -1)
                            
                cv2.putText(frame, note_name,
                           (text_x, text_y),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, 
                           (255, 255, 255),
                           1, cv2.LINE_AA)
            else:
                cv2.circle(frame, (fret_data['x_center'], int(y_pos)), 4, (128, 128, 128), -1)
                
    # Display debug info
    if fret_tracker.debug_mode and len(stable_frets) > 0:
        if fret_tracker.fret_numbers:
            cv2.putText(frame, f"Stable: {len(fret_tracker.fret_numbers)}", 
                       (10, frame.shape[0] - 50), cv2.FONT_HERSHEY_SIMPLEX, 
                       0.5, (128, 128, 255), 1, cv2.LINE_AA)

def custom_sink(predictions: dict, video_frame: VideoFrame, fretboard_notes: FretboardNotes, fret_tracker: FretTracker):
    frame = video_frame.image.copy()
    detections = predictions.get("predictions", [])
    
    # Update fret tracking with new detections
    fret_tracker.update(detections, frame.shape[0])
    
    # Draw scale notes on the stable frets
    draw_scale_notes(frame, fret_tracker, fretboard_notes)

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