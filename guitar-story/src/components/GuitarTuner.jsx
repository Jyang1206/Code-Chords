import React, { useEffect, useRef, useState, useContext } from "react";
import { ThemeContext } from "../App";
import "../css/GuitarTuner.css";
// You need to install pitchy: npm install pitchy
// import { createPitchDetector } from "pitchy";
import { PitchDetector } from "pitchy";

// Standard guitar string frequencies (Hz)
const GUITAR_STRINGS = [
  { note: "E2", freq: 82.41 },
  { note: "A2", freq: 110.00 },
  { note: "D3", freq: 146.83 },
  { note: "G3", freq: 196.00 },
  { note: "B3", freq: 246.94 },
  { note: "E4", freq: 329.63 },
];

function getClosestString(freq) {
  return GUITAR_STRINGS.reduce((prev, curr) =>
    Math.abs(curr.freq - freq) < Math.abs(prev.freq - freq) ? curr : prev
  );
}

const GuitarTuner = () => {
  const { lightMode } = useContext(ThemeContext);
  const [frequency, setFrequency] = useState(null);
  const [note, setNote] = useState(null);
  const [tuningStatus, setTuningStatus] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);
  const bufferLength = 2048;
  const listeningRef = useRef(false);
  // Track last valid pitch and note
  const [lastFrequency, setLastFrequency] = useState(null);
  const [lastNote, setLastNote] = useState(null);

  // Start microphone and pitch detection
  const startTuner = async () => {
    setError(null);
    setListening(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = bufferLength;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      detectPitchLoop();
    } catch (err) {
      setError("Microphone access denied or unavailable.");
      setListening(false);
    }
  };

  // Stop microphone and pitch detection
  const stopTuner = () => {
    setListening(false);
    if (animationRef.current) clearTimeout(animationRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setFrequency(null);
    setNote(null);
    setTuningStatus("");
  };

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  // Pitch detection loop (every 2 seconds)
  const detectPitchLoop = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const input = new Float32Array(bufferLength);
    const detector = PitchDetector.forFloat32Array(bufferLength);
    const loop = () => {
      analyser.getFloatTimeDomainData(input);
      const [pitch, clarity] = detector.findPitch(input, audioContextRef.current.sampleRate);
      if (clarity > 0.95 && pitch > 60 && pitch < 350) {
        setFrequency(pitch);
        const closest = getClosestString(pitch);
        setNote(closest.note);
        setLastFrequency(pitch);
        setLastNote(closest.note);
        const diff = pitch - closest.freq;
        if (Math.abs(diff) < 1) setTuningStatus("In Tune");
        else if (diff < 0) setTuningStatus("Too Low");
        else setTuningStatus("Too High");
      } else {
        setFrequency(null);
        setNote(null);
        setTuningStatus("No clear pitch");
      }
      if (listeningRef.current) {
        animationRef.current = setTimeout(loop, 200);
      }
    };
    loop();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopTuner();
    // eslint-disable-next-line
  }, []);

  // Compute the target frequency for the last detected note
  const targetFreq = lastNote ? GUITAR_STRINGS.find(s => s.note === lastNote)?.freq : null;
  // Compute rocket angle relative to target
  const rocketAngle = (lastFrequency && targetFreq)
    ? Math.max(-30, Math.min(30, (lastFrequency - targetFreq) * 5))
    : 0;

  // For the ticks, center tick is always at 0 (target), others are relative
  const tickAngles = [-30, -20, -10, 0, 10, 20, 30];

  // Space-themed UI
  return (
    <div className={`guitar-detection-panel space-tuner${lightMode ? " light" : " dark"}`}>
      <div className="space-bg">
        {/* Space background with stars/planets via CSS */}
        <div className="planet" />
        <div className="stars" />
      </div>
      <div className="tuner-container">
        <h2 className="tuner-title">🚀 Space Guitar Tuner</h2>
        <div className="tuner-display">
          {(lastFrequency || lastFrequency === 0) ? (
            <>
              <div className={`note-display${tuningStatus === 'No clear pitch' ? ' faded' : ''}`}>
                <span className="note">{lastNote || '--'}</span>
                <span className="freq">{lastFrequency ? lastFrequency.toFixed(2) : '--'} Hz</span>
              </div>
              <div className={`tuning-indicator ${tuningStatus.replace(/\s/g, "-").toLowerCase()}`}> 
                {/* Space needle/indicator */}
                <div className="needle-wrapper rocket-wrapper">
                  <svg
                    className="rocket-svg"
                    width="80"
                    height="120"
                    viewBox="0 0 80 120"
                    style={{
                      display: 'block',
                      margin: '0 auto'
                    }}
                  >
                    {/* Tuning tick marks (center tick is target) */}
                    <g className="tuning-ticks">
                      {tickAngles.map((angle, i) => {
                        const rad = (angle - 90) * Math.PI / 180;
                        const r1 = 60, r2 = angle === 0 ? 40 : 48;
                        const x1 = 40 + r1 * Math.cos(rad);
                        const y1 = 70 + r1 * Math.sin(rad);
                        const x2 = 40 + r2 * Math.cos(rad);
                        const y2 = 70 + r2 * Math.sin(rad);
                        return (
                          <line
                            key={angle}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={angle === 0 ? '#ff0' : '#6cf'}
                            strokeWidth={angle === 0 ? 3 : 1.5}
                            opacity={angle === 0 ? 1 : 0.7}
                          />
                        );
                      })}
                    </g>
                    {/* Rocket and flame group, which rotates */}
                    <g style={{
                      transform: `rotate(${rocketAngle}deg)`,
                      transformOrigin: '40px 70px',
                      transition: 'transform 0.15s cubic-bezier(.4,2,.6,1)'
                    }}>
                      {/* Rocket body */}
                      <rect x="34" y="30" width="12" height="40" rx="6" fill="#fff" stroke="#6cf" strokeWidth="2"/>
                      {/* Rocket window */}
                      <ellipse cx="40" cy="45" rx="4" ry="6" fill="#6cf" stroke="#fff" strokeWidth="1"/>
                      {/* Rocket nose cone */}
                      <polygon points="40,10 30,30 50,30" fill="#6cf"/>
                      {/* Rocket fins */}
                      <polygon points="30,70 20,90 40,80" fill="#23a"/>
                      <polygon points="50,70 60,90 40,80" fill="#23a"/>
                      {/* Rocket flame - animate size and color with frequency */}
                      <g className="rocket-flame-group">
                        <polygon
                          className="rocket-flame"
                          points={`36,70 44,70 40,${90 + (lastFrequency ? Math.min(20, Math.max(0, (lastFrequency - 80) / 2)) : 10)}`}
                          fill={
                            lastFrequency
                              ? lastFrequency < 120
                                ? '#f90'
                                : lastFrequency < 200
                                  ? '#ff0'
                                  : '#0f0'
                              : '#f90'
                          }
                          style={{
                            filter: 'drop-shadow(0 0 10px #ff0) drop-shadow(0 0 20px #f90)',
                            transition: 'all 0.2s'
                          }}
                        />
                        {/* Inner flame for more effect */}
                        <polygon
                          points={`38,70 42,70 40,${80 + (lastFrequency ? Math.min(10, Math.max(0, (lastFrequency - 80) / 4)) : 5)}`}
                          fill="#fff"
                          opacity="0.7"
                        />
                      </g>
                    </g>
                  </svg>
                  <div className="indicator-arc" />
                </div>
                <span className="tuning-status">{tuningStatus}</span>
              </div>
              {/* Digital frequency readout */}
              <div className="digital-frequency-readout">
                <span>Pitch: </span>
                <span className="freq-value">{frequency ? frequency.toFixed(2) : '--'} Hz</span>
              </div>
            </>
          ) : (
            <div className="note-display">
              <span className="note">--</span>
              <span className="freq">Listening...</span>
            </div>
          )}
        </div>
        <div className="tuner-controls">
          {!listening ? (
            <button onClick={startTuner} className="start-btn">Start Tuner</button>
          ) : (
            <button onClick={stopTuner} className="stop-btn">Stop Tuner</button>
          )}
        </div>
        {error && <div className="tuner-error">{error}</div>}
        <div className="string-list">
          <h4>Standard Tuning</h4>
          <ul>
            {GUITAR_STRINGS.map(s => (
              <li key={s.note}>
                <span className="string-note">{s.note}</span> <span className="string-freq">{s.freq} Hz</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GuitarTuner; 