// Music utility functions
export const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_FREQS = [
  16.35, 17.32, 18.35, 19.45, 20.60, 21.83, 23.12, 24.50, 25.96, 27.50, 29.14, 30.87, // C0-B0
  32.70, 34.65, 36.71, 38.89, 41.20, 43.65, 46.25, 49.00, 51.91, 55.00, 58.27, 61.74, // C1-B1
  65.41, 69.30, 73.42, 77.78, 82.41, 87.31, 92.50, 98.00, 103.83, 110.00, 116.54, 123.47, // C2-B2
  130.81, 138.59, 146.83, 155.56, 164.81, 174.61, 185.00, 196.00, 207.65, 220.00, 233.08, 246.94, // C3-B3
  261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88, // C4-B4
  523.25, 554.37, 587.33, 622.25, 659.25, 698.46, 739.99, 783.99, 830.61, 880.00, 932.33, 987.77, // C5-B5
  1046.50, 1108.73, 1174.66, 1244.51, 1318.51, 1396.91, 1479.98, 1567.98, 1661.22, 1760.00, 1864.66, 1975.53, // C6-B6
  2093.00, 2217.46, 2349.32, 2489.02, 2637.02, 2793.83, 2959.96, 3135.96, 3322.44, 3520.00, 3729.31, 3951.07 // C7-B7
];

// Frequency to note mapping function
export function freqToNote(freq) {
  if (freq == null || freq <= 0) {
    throw new Error('Frequency must be a positive number');
  }
  
  let minDiff = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < NOTE_FREQS.length; i++) {
    let diff = Math.abs(NOTE_FREQS[i] - freq);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }
  const noteName = ALL_NOTES[closestIdx % 12];
  const octave = Math.floor(closestIdx / 12);
  return { note: noteName, octave, freq: NOTE_FREQS[closestIdx] };
}

// Guitar string note calculation
export const OPEN_STRINGS = ['E', 'A', 'D', 'G', 'B', 'E']; // 6th to 1st string

export function getNoteAtPosition(stringIdx, fretNum) {
  if (stringIdx < 0 || stringIdx >= OPEN_STRINGS.length) {
    throw new Error('Invalid string index');
  }
  if (fretNum < 0) {
    throw new Error('Invalid fret number');
  }
  
  const openNoteIdx = ALL_NOTES.indexOf(OPEN_STRINGS[stringIdx]);
  const noteIdx = (openNoteIdx + fretNum) % 12;
  return ALL_NOTES[noteIdx];
}

// Scale calculation functions
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

export function getScaleNotes(root, scaleName) {
  const rootIdx = ALL_NOTES.indexOf(root);
  if (rootIdx === -1) return [];
  
  const intervals = SCALES[scaleName];
  if (!intervals) return [];
  
  return intervals.map((interval) => ALL_NOTES[(rootIdx + interval) % 12]);
}

export function getStringNotePositions(stringIdx, scaleNotes, numFrets = 12) {
  const openNoteIdx = ALL_NOTES.indexOf(OPEN_STRINGS[stringIdx]);
  let positions = [];
  for (let fret = 0; fret <= numFrets; fret++) {
    const noteIdx = (openNoteIdx + fret) % 12;
    if (scaleNotes.includes(ALL_NOTES[noteIdx])) {
      positions.push(fret);
    }
  }
  return positions;
}

// Guitar tuning functions
export const GUITAR_STRINGS = [
  { note: "E2", freq: 82.41 },
  { note: "A2", freq: 110.00 },
  { note: "D3", freq: 146.83 },
  { note: "G3", freq: 196.00 },
  { note: "B3", freq: 246.94 },
  { note: "E4", freq: 329.63 },
];

export function getClosestString(freq) {
  return GUITAR_STRINGS.reduce((prev, curr) =>
    Math.abs(curr.freq - freq) < Math.abs(prev.freq - freq) ? curr : prev
  );
}

// Timing accuracy calculation
export function calculateTimingAccuracy(expectedTime, actualTime) {
  const diff = Math.abs(actualTime - expectedTime);
  if (diff <= 10) return { level: 'Perfect', score: 10, color: '#2e7d32' };
  if (diff <= 20) return { level: 'Excellent', score: 8, color: '#4caf50' };
  if (diff <= 40) return { level: 'Good', score: 6, color: '#8bc34a' };
  if (diff <= 80) return { level: 'Okay', score: 4, color: '#ff9800' };
  if (diff <= 100) return { level: 'Miss', score: 2, color: '#f44336' };
  return { level: 'Too Late', score: 0, color: '#d32f2f' };
}

// Note validation functions
export function isValidNote(note) {
  return ALL_NOTES.includes(note);
}

export function isValidStringIndex(stringIdx) {
  return stringIdx >= 1 && stringIdx <= 6;
}

export function isValidFretNumber(fretNum) {
  return fretNum >= 0 && fretNum <= 24;
}

// Chord calculation functions
export function calculateChordNotes(root, chordType = 'major') {
  const rootIdx = ALL_NOTES.indexOf(root);
  if (rootIdx === -1) return null;
  
  const intervals = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
    major7: [0, 4, 7, 11],
    minor7: [0, 3, 7, 10],
    dominant7: [0, 4, 7, 10]
  };
  
  const chordIntervals = intervals[chordType] || intervals.major;
  return chordIntervals.map(interval => ALL_NOTES[(rootIdx + interval) % 12]);
} 