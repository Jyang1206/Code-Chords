import React, { useEffect, useRef, useState, useContext } from "react";
import { ThemeContext } from "../App";
import "../css/GuitarTuner.css";
// You need to install pitchy: npm install pitchy
// import { createPitchDetector } from "pitchy";
import AudioPitchDetector from "../utils/AudioPitchDetector";

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
  const [tuningStatus, setTuningStatus] = useState("");
  // Track last valid pitch and note
  const [lastFrequency, setLastFrequency] = useState(null);
  const [lastNote, setLastNote] = useState(null);

  // Use AudioPitchDetector for pitch detection
  // We'll use the render prop to get note, frequency, clarity, listening, start, stop, error
  // We'll keep lastFrequency/lastNote for the UI as before
  // We'll keep tuningStatus logic in a useEffect

  // Compute the target frequency for the last detected note
  const targetFreq = lastNote ? GUITAR_STRINGS.find(s => s.note === lastNote)?.freq : null;
  // Compute rocket angle relative to target
  const rocketAngle = (lastFrequency && targetFreq)
    ? Math.max(-30, Math.min(30, (lastFrequency - targetFreq) * 5))
    : 0;

  // For the ticks, center tick is always at 0 (target), others are relative
  const tickAngles = [-30, -20, -10, 0, 10, 20, 30];

  return (
    <AudioPitchDetector>
      {({ note, frequency, clarity, listening, start, stop, error }) => {
        // Update lastFrequency/lastNote and tuningStatus as in the old loop
        useEffect(() => {
          if (frequency && note) {
            const closest = getClosestString(frequency);
            setLastFrequency(frequency);
            setLastNote(closest.note);
            const diff = frequency - closest.freq;
            if (Math.abs(diff) < 1) setTuningStatus("In Tune");
            else if (diff < 0) setTuningStatus("Too Low");
            else setTuningStatus("Too High");
          } else {
            setTuningStatus("No clear pitch");
          }
        }, [frequency, note]);

        // Compute the target frequency for the last detected note
        const targetFreq = lastNote ? GUITAR_STRINGS.find(s => s.note === lastNote)?.freq : null;
        const rocketAngle = (lastFrequency && targetFreq)
          ? Math.max(-30, Math.min(30, (lastFrequency - targetFreq) * 5))
          : 0;

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
                  <button onClick={start} className="start-btn">Start Tuner</button>
                ) : (
                  <button onClick={stop} className="stop-btn">Stop Tuner</button>
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
      }}
    </AudioPitchDetector>
  );
};

export default GuitarTuner; 