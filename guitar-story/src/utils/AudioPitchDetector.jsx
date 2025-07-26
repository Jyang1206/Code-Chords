import { useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";

// Standard note names and frequencies for mapping
const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_FREQS = [
  16.35, 17.32, 18.35, 19.45, 20.60, 21.83, 23.12, 24.50, 25.96, 27.50, 29.14, 30.87, // C0-B0
  32.70, 34.65, 36.71, 38.89, 41.20, 43.65, 46.25, 49.00, 51.91, 55.00, 58.27, 61.74, // C1-B1
  65.41, 69.30, 73.42, 77.78, 82.41, 87.31, 92.50, 98.00, 103.83, 110.00, 116.54, 123.47, // C2-B2
  130.81, 138.59, 146.83, 155.56, 164.81, 174.61, 185.00, 196.00, 207.65, 220.00, 233.08, 246.94, // C3-B3
  261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.00, 415.30, 440.00, 466.16, 493.88, // C4-B4
  523.25, 554.37, 587.33, 622.25, 659.25, 698.46, 739.99, 783.99, 830.61, 880.00, 932.33, 987.77, // C5-B5
  1046.50, 1108.73, 1174.66, 1244.51, 1318.51, 1396.91, 1479.98, 1567.98, 1661.22, 1760.00, 1864.66, 1975.53, // C6-B6
  2093.00, 2217.46, 2349.32, 2489.02, 2637.02, 2793.83, 2959.96, 3135.96, 3322.44, 3520.00, 3729.31, 3951.07 // C7-B7
];
function freqToNote(freq) {
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

export default function AudioPitchDetector({ children, bufferLength = 2048, clarityThreshold = 0.95, minFreq = 60, maxFreq = 1200 }) {
  const [frequency, setFrequency] = useState(null);
  const [note, setNote] = useState(null);
  const [clarity, setClarity] = useState(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);
  const listeningRef = useRef(false);
  const startingRef = useRef(false); // Prevent multiple simultaneous starts

  // Start microphone and pitch detection
  const start = async () => {
    // Prevent multiple simultaneous starts
    if (startingRef.current || listeningRef.current) {
      console.log('Audio detection already starting or running');
      return;
    }
    
    startingRef.current = true;
    setError(null);
    setListening(true);
    
    try {
      // Stop any existing audio context first
      if (audioContextRef.current) {
        try {
          await audioContextRef.current.close();
        } catch (e) {
          console.log('Error closing existing audio context:', e);
        }
        audioContextRef.current = null;
        analyserRef.current = null;
        sourceRef.current = null;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = bufferLength;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      
      // Start the pitch detection loop
      detectPitchLoop();
      
    } catch (err) {
      console.error('Error starting audio detection:', err);
      setError("Microphone access denied or unavailable.");
      setListening(false);
    } finally {
      startingRef.current = false;
    }
  };

  // Stop microphone and pitch detection
  const stop = () => {
    setListening(false);
    
    // Clear the animation timeout
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.log('Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }
    
    // Clear refs
    analyserRef.current = null;
    sourceRef.current = null;
    
    // Reset state
    setFrequency(null);
    setNote(null);
    setClarity(null);
  };

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  // Pitch detection loop (setTimeout-based, like GuitarTuner)
  const detectPitchLoop = () => {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    
    if (!analyser || !audioContext) {
      console.log('Audio context or analyser not available, stopping pitch detection');
      return;
    }
    
    const input = new Float32Array(bufferLength);
    const detector = PitchDetector.forFloat32Array(bufferLength);
    
    const loop = () => {
      // Check if audio context is still valid
      if (!audioContextRef.current || !analyserRef.current) {
        console.log('Audio context closed, stopping pitch detection loop');
        return;
      }
      
      try {
        analyser.getFloatTimeDomainData(input);
        const [pitch, clarityVal] = detector.findPitch(input, audioContext.sampleRate);
        setClarity(clarityVal);
        
        if (clarityVal > clarityThreshold && pitch > minFreq && pitch < maxFreq) {
          setFrequency(pitch);
          const { note, octave } = freqToNote(pitch);
          setNote(note + octave);
        } else {
          setFrequency(null);
          setNote(null);
        }
      } catch (error) {
        console.error('Error in pitch detection loop:', error);
        // If there's an error, stop the loop
        return;
      }
      
      // Continue loop only if still listening
      if (listeningRef.current && audioContextRef.current) {
        animationRef.current = setTimeout(loop, 200);
      }
    };
    
    loop();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line
  }, []);

  return children({
    note,
    frequency,
    clarity,
    listening,
    start,
    stop,
    error
  });
} 