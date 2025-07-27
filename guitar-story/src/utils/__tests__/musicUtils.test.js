// Music utility functions for testing
import {
  ALL_NOTES,
  NOTE_FREQS,
  freqToNote,
  OPEN_STRINGS,
  getNoteAtPosition,
  SCALES,
  getScaleNotes,
  getStringNotePositions,
  GUITAR_STRINGS,
  getClosestString,
  calculateTimingAccuracy,
  isValidNote,
  isValidStringIndex,
  isValidFretNumber,
  calculateChordNotes
} from '../musicUtils';

describe('Music Utilities', () => {
  describe('Frequency to Note Mapping', () => {
    test('maps frequency to correct note', () => {
      expect(freqToNote(440).note).toBe('A');
      expect(freqToNote(440).octave).toBe(4);
    });

    test('maps A4 frequency correctly', () => {
      const result = freqToNote(440);
      expect(result.note).toBe('A');
      expect(result.octave).toBe(4);
      expect(result.freq).toBe(440);
    });

    test('maps C4 frequency correctly', () => {
      const result = freqToNote(261.63);
      expect(result.note).toBe('C');
      expect(result.octave).toBe(4);
    });

    test('maps E2 frequency correctly', () => {
      const result = freqToNote(82.41);
      expect(result.note).toBe('E');
      expect(result.octave).toBe(2);
    });

    test('handles frequencies slightly off from exact notes', () => {
      const result = freqToNote(442); // Slightly sharp A4
      expect(result.note).toBe('A');
      expect(result.octave).toBe(4);
    });

    test('handles very low frequencies', () => {
      const result = freqToNote(20);
      expect(result.note).toBe('D#');
      expect(result.octave).toBe(0);
    });

    test('handles very high frequencies', () => {
      const result = freqToNote(4000);
      expect(result.note).toBe('B');
      expect(result.octave).toBe(7);
    });

    test('maps all standard guitar string frequencies', () => {
      const guitarFreqs = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];
      const expectedNotes = ['E', 'A', 'D', 'G', 'B', 'E'];
      const expectedOctaves = [2, 2, 3, 3, 3, 4];
      
      guitarFreqs.forEach((freq, index) => {
        const result = freqToNote(freq);
        expect(result.note).toBe(expectedNotes[index]);
        expect(result.octave).toBe(expectedOctaves[index]);
      });
    });
  });

  describe('Guitar Note Position Calculation', () => {
    test('calculates open string notes correctly', () => {
      expect(getNoteAtPosition(0, 0)).toBe('E'); // 6th string open
      expect(getNoteAtPosition(1, 0)).toBe('A'); // 5th string open
      expect(getNoteAtPosition(2, 0)).toBe('D'); // 4th string open
      expect(getNoteAtPosition(3, 0)).toBe('G'); // 3rd string open
      expect(getNoteAtPosition(4, 0)).toBe('B'); // 2nd string open
      expect(getNoteAtPosition(5, 0)).toBe('E'); // 1st string open
    });

    test('calculates fretted notes correctly', () => {
      expect(getNoteAtPosition(0, 3)).toBe('G'); // 6th string, 3rd fret
      expect(getNoteAtPosition(1, 2)).toBe('B'); // 5th string, 2nd fret
      expect(getNoteAtPosition(2, 2)).toBe('E'); // 4th string, 2nd fret
      expect(getNoteAtPosition(3, 2)).toBe('A'); // 3rd string, 2nd fret
      expect(getNoteAtPosition(4, 1)).toBe('C'); // 2nd string, 1st fret
      expect(getNoteAtPosition(5, 3)).toBe('G'); // 1st string, 3rd fret
    });

    test('handles notes that wrap around the octave', () => {
      expect(getNoteAtPosition(0, 12)).toBe('E'); // 6th string, 12th fret (octave)
      expect(getNoteAtPosition(1, 12)).toBe('A'); // 5th string, 12th fret (octave)
      expect(getNoteAtPosition(2, 12)).toBe('D'); // 4th string, 12th fret (octave)
    });

    test('calculates C major scale positions on 6th string', () => {
      // C major scale: C, D, E, F, G, A, B
      const cMajorNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      const positions = [];
      
      for (let fret = 0; fret <= 12; fret++) {
        const note = getNoteAtPosition(0, fret);
        if (cMajorNotes.includes(note)) {
          positions.push({ fret, note });
        }
      }
      
      expect(positions).toEqual([
        { fret: 0, note: 'E' },
        { fret: 1, note: 'F' },
        { fret: 3, note: 'G' },
        { fret: 5, note: 'A' },
        { fret: 7, note: 'B' },
        { fret: 8, note: 'C' },
        { fret: 10, note: 'D' },
        { fret: 12, note: 'E' }
      ]);
    });
  });

  describe('Scale Calculation', () => {
    test('calculates C major scale correctly', () => {
      const scale = getScaleNotes('C', 'major');
      expect(scale).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    });

    test('calculates A minor scale correctly', () => {
      const scale = getScaleNotes('A', 'minor');
      expect(scale).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    });

    test('calculates G pentatonic major scale correctly', () => {
      const scale = getScaleNotes('G', 'pentatonic_major');
      expect(scale).toEqual(['G', 'A', 'B', 'D', 'E']);
    });

    test('calculates E blues scale correctly', () => {
      const scale = getScaleNotes('E', 'blues');
      expect(scale).toEqual(['E', 'G', 'A', 'A#', 'B', 'D']);
    });

    test('handles sharps and flats in scale names', () => {
      const scale = getScaleNotes('F#', 'major');
      expect(scale).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'F']);
    });

    test('returns empty array for invalid scale', () => {
      const scale = getScaleNotes('C', 'invalid_scale');
      expect(scale).toEqual([]);
    });
  });

  describe('String Note Positions', () => {
    test('finds C major scale positions on 6th string', () => {
      const cMajorNotes = getScaleNotes('C', 'major');
      const positions = getStringNotePositions(0, cMajorNotes);
      expect(positions).toEqual([0, 1, 3, 5, 7, 8, 10, 12]);
    });

    test('finds A minor scale positions on 5th string', () => {
      const aMinorNotes = getScaleNotes('A', 'minor');
      const positions = getStringNotePositions(1, aMinorNotes);
      expect(positions).toEqual([0, 2, 3, 5, 7, 8, 10, 12]);
    });

    test('finds G pentatonic positions on 4th string', () => {
      const gPentatonicNotes = getScaleNotes('G', 'pentatonic_major');
      const positions = getStringNotePositions(2, gPentatonicNotes);
      expect(positions).toEqual([0, 2, 5, 7, 9, 12]);
    });

    test('handles custom number of frets', () => {
      const cMajorNotes = getScaleNotes('C', 'major');
      const positions = getStringNotePositions(0, cMajorNotes, 6);
      expect(positions).toEqual([0, 1, 3, 5]);
    });
  });

  describe('Guitar String Closest Match', () => {
    test('finds closest guitar string for E2', () => {
      const result = getClosestString(82.41);
      expect(result.note).toBe('E2');
      expect(result.freq).toBe(82.41);
    });

    test('finds closest guitar string for A2', () => {
      const result = getClosestString(110.00);
      expect(result.note).toBe('A2');
      expect(result.freq).toBe(110.00);
    });

    test('finds closest guitar string for slightly off frequencies', () => {
      const result = getClosestString(85); // Slightly sharp E2
      expect(result.note).toBe('E2');
      expect(result.freq).toBe(82.41);
    });

    test('finds closest guitar string for frequencies between strings', () => {
      const result = getClosestString(100); // Between E2 and A2
      expect(result.note).toBe('A2');
      expect(result.freq).toBe(110.00);
    });

    test('handles very low frequencies', () => {
      const result = getClosestString(50);
      expect(result.note).toBe('E2');
      expect(result.freq).toBe(82.41);
    });

    test('handles very high frequencies', () => {
      const result = getClosestString(400);
      expect(result.note).toBe('E4');
      expect(result.freq).toBe(329.63);
    });
  });

  describe('Timing Accuracy Calculation', () => {
    test('calculates perfect timing', () => {
      const result = calculateTimingAccuracy(1000, 1005);
      expect(result.level).toBe('Perfect');
      expect(result.score).toBe(10);
      expect(result.color).toBe('#2e7d32');
    });

    test('calculates excellent timing', () => {
      const result = calculateTimingAccuracy(1000, 1015);
      expect(result.level).toBe('Excellent');
      expect(result.score).toBe(8);
      expect(result.color).toBe('#4caf50');
    });

    test('calculates good timing', () => {
      const result = calculateTimingAccuracy(1000, 1030);
      expect(result.level).toBe('Good');
      expect(result.score).toBe(6);
      expect(result.color).toBe('#8bc34a');
    });

    test('calculates okay timing', () => {
      const result = calculateTimingAccuracy(1000, 1070);
      expect(result.level).toBe('Okay');
      expect(result.score).toBe(4);
      expect(result.color).toBe('#ff9800');
    });

    test('calculates miss timing', () => {
      const result = calculateTimingAccuracy(1000, 1090);
      expect(result.level).toBe('Miss');
      expect(result.score).toBe(2);
      expect(result.color).toBe('#f44336');
    });

    test('calculates too late timing', () => {
      const result = calculateTimingAccuracy(1000, 1110);
      expect(result.level).toBe('Too Late');
      expect(result.score).toBe(0);
      expect(result.color).toBe('#d32f2f');
    });

    test('handles early timing', () => {
      const result = calculateTimingAccuracy(1000, 990);
      expect(result.level).toBe('Perfect');
      expect(result.score).toBe(10);
    });
  });

  describe('Note Validation', () => {
    test('validates correct notes', () => {
      expect(isValidNote('C')).toBe(true);
      expect(isValidNote('F#')).toBe(true);
      expect(isValidNote('A')).toBe(true);
      expect(isValidNote('B')).toBe(true);
    });

    test('rejects invalid notes', () => {
      expect(isValidNote('H')).toBe(false);
      expect(isValidNote('X')).toBe(false);
      expect(isValidNote('')).toBe(false);
      expect(isValidNote(null)).toBe(false);
      expect(isValidNote(undefined)).toBe(false);
    });

    test('validates string indices', () => {
      expect(isValidStringIndex(1)).toBe(true);
      expect(isValidStringIndex(6)).toBe(true);
      expect(isValidStringIndex(3)).toBe(true);
    });

    test('rejects invalid string indices', () => {
      expect(isValidStringIndex(0)).toBe(false);
      expect(isValidStringIndex(7)).toBe(false);
      expect(isValidStringIndex(-1)).toBe(false);
    });

    test('validates fret numbers', () => {
      expect(isValidFretNumber(0)).toBe(true);
      expect(isValidFretNumber(12)).toBe(true);
      expect(isValidFretNumber(24)).toBe(true);
    });

    test('rejects invalid fret numbers', () => {
      expect(isValidFretNumber(-1)).toBe(false);
      expect(isValidFretNumber(25)).toBe(false);
    });
  });

  describe('Chord Calculation', () => {
    test('calculates C major chord', () => {
      const chord = calculateChordNotes('C', 'major');
      expect(chord).toEqual(['C', 'E', 'G']);
    });

    test('calculates A minor chord', () => {
      const chord = calculateChordNotes('A', 'minor');
      expect(chord).toEqual(['A', 'C', 'E']);
    });

    test('calculates G major chord', () => {
      const chord = calculateChordNotes('G', 'major');
      expect(chord).toEqual(['G', 'B', 'D']);
    });

    test('calculates F major chord', () => {
      const chord = calculateChordNotes('F', 'major');
      expect(chord).toEqual(['F', 'A', 'C']);
    });

    test('calculates C major 7 chord', () => {
      const chord = calculateChordNotes('C', 'major7');
      expect(chord).toEqual(['C', 'E', 'G', 'B']);
    });

    test('calculates A minor 7 chord', () => {
      const chord = calculateChordNotes('A', 'minor7');
      expect(chord).toEqual(['A', 'C', 'E', 'G']);
    });

    test('calculates G dominant 7 chord', () => {
      const chord = calculateChordNotes('G', 'dominant7');
      expect(chord).toEqual(['G', 'B', 'D', 'F']);
    });

    test('returns null for invalid root note', () => {
      const chord = calculateChordNotes('X', 'major');
      expect(chord).toBe(null);
    });

    test('defaults to major chord for invalid chord type', () => {
      const chord = calculateChordNotes('C', 'invalid');
      expect(chord).toEqual(['C', 'E', 'G']);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('handles null frequency input', () => {
      expect(() => freqToNote(null)).toThrow('Frequency must be a positive number');
    });

    test('handles negative frequency input', () => {
      expect(() => freqToNote(-440)).toThrow('Frequency must be a positive number');
    });

    test('handles zero frequency input', () => {
      expect(() => freqToNote(0)).toThrow('Frequency must be a positive number');
    });

    test('handles invalid string index in getNoteAtPosition', () => {
      expect(() => getNoteAtPosition(-1, 0)).toThrow('Invalid string index');
      expect(() => getNoteAtPosition(6, 0)).toThrow('Invalid string index');
    });

    test('handles negative fret number in getNoteAtPosition', () => {
      expect(() => getNoteAtPosition(0, -1)).toThrow('Invalid fret number');
    });

    test('handles invalid scale name', () => {
      const scale = getScaleNotes('C', 'nonexistent');
      expect(scale).toEqual([]);
    });

    test('handles invalid root note in scale calculation', () => {
      const scale = getScaleNotes('X', 'major');
      expect(scale).toEqual([]);
    });
  });

  describe('Performance Tests', () => {
    test('frequency mapping is fast for large number of frequencies', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        freqToNote(440 + Math.random() * 100);
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    test('note position calculation is fast for all positions', () => {
      const startTime = performance.now();
      
      for (let string = 0; string < 6; string++) {
        for (let fret = 0; fret <= 12; fret++) {
          getNoteAtPosition(string, fret);
        }
      }
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
    });
  });
}); 