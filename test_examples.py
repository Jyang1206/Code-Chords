# Example test file showing both unittest and pytest usage
# This file demonstrates how to write tests for your guitar learning application

import unittest
import pytest
from unittest.mock import Mock, patch

# Example functions to test (replace with your actual functions)
def add_note_to_chord(chord, note):
    """Add a note to a chord"""
    if note not in chord:
        chord.append(note)
    return chord

def calculate_score(correct_notes, total_notes):
    """Calculate accuracy score"""
    if total_notes == 0:
        return 0
    return (correct_notes / total_notes) * 100

def validate_string_index(string_idx):
    """Validate guitar string index (1-6)"""
    return 1 <= string_idx <= 6

# ============================================================================
# UNITTEST EXAMPLES
# ============================================================================

class TestGuitarFunctions(unittest.TestCase):
    """Test cases using unittest framework"""
    
    def setUp(self):
        """Set up test fixtures before each test method"""
        self.test_chord = ['C', 'E', 'G']
    
    def test_add_note_to_chord(self):
        """Test adding a note to a chord"""
        result = add_note_to_chord(self.test_chord.copy(), 'A')
        self.assertEqual(result, ['C', 'E', 'G', 'A'])
        self.assertEqual(len(result), 4)
    
    def test_add_existing_note_to_chord(self):
        """Test adding an existing note to a chord"""
        result = add_note_to_chord(self.test_chord.copy(), 'C')
        self.assertEqual(result, ['C', 'E', 'G'])
        self.assertEqual(len(result), 3)
    
    def test_calculate_score_perfect(self):
        """Test perfect score calculation"""
        score = calculate_score(10, 10)
        self.assertEqual(score, 100.0)
    
    def test_calculate_score_partial(self):
        """Test partial score calculation"""
        score = calculate_score(5, 10)
        self.assertEqual(score, 50.0)
    
    def test_calculate_score_zero_total(self):
        """Test score calculation with zero total notes"""
        score = calculate_score(0, 0)
        self.assertEqual(score, 0)
    
    def test_validate_string_index_valid(self):
        """Test valid string index validation"""
        self.assertTrue(validate_string_index(1))
        self.assertTrue(validate_string_index(6))
        self.assertTrue(validate_string_index(3))
    
    def test_validate_string_index_invalid(self):
        """Test invalid string index validation"""
        self.assertFalse(validate_string_index(0))
        self.assertFalse(validate_string_index(7))
        self.assertFalse(validate_string_index(-1))
    
    def test_chord_arpeggio_c_major(self):
        """Test C Major chord arpeggio"""
        c_major_notes = ['C', 'E', 'G', 'C', 'E']
        self.assertEqual(len(c_major_notes), 5)
        self.assertIn('C', c_major_notes)
        self.assertIn('E', c_major_notes)
        self.assertIn('G', c_major_notes)
    
    def test_chord_arpeggio_d_major(self):
        """Test D Major chord arpeggio"""
        d_major_notes = ['D', 'F#', 'A', 'D']
        self.assertEqual(len(d_major_notes), 4)
        self.assertIn('D', d_major_notes)
        self.assertIn('F#', d_major_notes)
        self.assertIn('A', d_major_notes)

# ============================================================================
# PYTEST EXAMPLES
# ============================================================================

# Pytest fixtures
@pytest.fixture
def sample_chord():
    """Fixture providing a sample chord"""
    return ['C', 'E', 'G']

@pytest.fixture
def sample_scores():
    """Fixture providing sample score data"""
    return {
        'perfect': (10, 10),
        'partial': (5, 10),
        'zero': (0, 0)
    }

# Pytest test functions
def test_add_note_to_chord_pytest(sample_chord):
    """Test adding a note to a chord using pytest"""
    result = add_note_to_chord(sample_chord.copy(), 'A')
    assert result == ['C', 'E', 'G', 'A']
    assert len(result) == 4

def test_add_existing_note_to_chord_pytest(sample_chord):
    """Test adding an existing note to a chord using pytest"""
    result = add_note_to_chord(sample_chord.copy(), 'C')
    assert result == ['C', 'E', 'G']
    assert len(result) == 3

@pytest.mark.parametrize("correct,total,expected", [
    (10, 10, 100.0),
    (5, 10, 50.0),
    (0, 0, 0),
    (3, 6, 50.0),
    (8, 10, 80.0)
])
def test_calculate_score_parametrized(correct, total, expected):
    """Test score calculation with different parameters"""
    score = calculate_score(correct, total)
    assert score == expected

@pytest.mark.parametrize("string_idx,expected", [
    (1, True),
    (6, True),
    (3, True),
    (0, False),
    (7, False),
    (-1, False)
])
def test_validate_string_index_parametrized(string_idx, expected):
    """Test string index validation with different values"""
    result = validate_string_index(string_idx)
    assert result == expected

def test_chord_arpeggios():
    """Test various chord arpeggios"""
    # Test C Major
    c_major = ['C', 'E', 'G', 'C', 'E']
    assert len(c_major) == 5
    assert 'C' in c_major
    assert 'E' in c_major
    assert 'G' in c_major
    
    # Test D Major
    d_major = ['D', 'F#', 'A', 'D']
    assert len(d_major) == 4
    assert 'D' in d_major
    assert 'F#' in d_major
    assert 'A' in d_major
    
    # Test E Major
    e_major = ['E', 'G#', 'B', 'E', 'G#', 'B']
    assert len(e_major) == 6
    assert 'E' in e_major
    assert 'G#' in e_major
    assert 'B' in e_major

# Mock testing examples
def test_firebase_operations_with_mock():
    """Test Firebase operations using mocks"""
    with patch('firebase_admin.firestore') as mock_firestore:
        # Mock the Firestore client
        mock_client = Mock()
        mock_firestore.client.return_value = mock_client
        
        # Mock collection and document operations
        mock_collection = Mock()
        mock_client.collection.return_value = mock_collection
        
        # Test adding a custom tab
        mock_doc = Mock()
        mock_doc.id = 'test-tab-id'
        mock_collection.add.return_value = mock_doc
        
        # Simulate adding a tab
        result = mock_collection.add({'title': 'Test Tab', 'notes': []})
        
        # Verify the operation
        assert result.id == 'test-tab-id'
        mock_collection.add.assert_called_once()

def test_audio_detection_with_mock():
    """Test audio detection using mocks"""
    with patch('pitchy.PitchDetector') as mock_pitch_detector:
        # Mock the pitch detector
        mock_detector = Mock()
        mock_pitch_detector.return_value = mock_detector
        
        # Mock detection results
        mock_detector.findPitch.return_value = ('C', 0.95)
        
        # Test note detection
        detector = mock_pitch_detector()
        note, confidence = detector.findPitch(b'audio_data')
        
        assert note == 'C'
        assert confidence == 0.95

# Performance testing example
@pytest.mark.slow
def test_audio_processing_performance():
    """Test audio processing performance"""
    import time
    
    start_time = time.time()
    
    # Simulate audio processing
    for _ in range(100):
        calculate_score(5, 10)
    
    end_time = time.time()
    processing_time = end_time - start_time
    
    # Assert processing time is reasonable (less than 1 second)
    assert processing_time < 1.0

# Integration testing example
def test_chord_to_score_integration():
    """Integration test: chord creation to score calculation"""
    # Create a chord
    chord = ['C', 'E', 'G']
    
    # Add a note
    chord = add_note_to_chord(chord, 'A')
    
    # Calculate score based on correct notes
    correct_notes = 4  # All notes are correct
    total_notes = 4
    score = calculate_score(correct_notes, total_notes)
    
    # Verify the integration
    assert len(chord) == 4
    assert score == 100.0
    assert 'A' in chord

if __name__ == '__main__':
    # Run unittest tests
    unittest.main(verbosity=2) 