import React, { useEffect, useRef, useState } from "react";
import "../css/GuitarTuner.css";
// You need to install pitchy: npm install pitchy
// import { createPitchDetector } from "pitchy";
import AudioPitchDetector from "./AudioPitchDetector";

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
    <div style={{
      background: "linear-gradient(135deg, #0c0e1a 0%, #1a1b2e 50%, #2d1b69 100%)",
      color: "#fff",
      fontFamily: "'Orbitron', 'Montserrat', 'Arial', sans-serif",
      minHeight: "100vh",
      padding: "2rem"
    }}>
      <div style={{
        maxWidth: "800px",
        margin: "0 auto"
      }}>
        <h1 style={{
          textAlign: "center",
          fontSize: "2.5rem",
          fontWeight: "700",
          background: "linear-gradient(45deg, #90caf9, #7e57c2)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "2rem"
        }}>
          🚀 Space Guitar Tuner
        </h1>
        
        <div style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(10px)",
          borderRadius: "20px",
          padding: "2rem",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
        }}>
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
                <div style={{
                  textAlign: "center"
                }}>
                  <div style={{
                    marginBottom: "2rem"
                  }}>
                    {(lastFrequency || lastFrequency === 0) ? (
                      <>
                        <div style={{
                          marginBottom: "1rem",
                          opacity: tuningStatus === 'No clear pitch' ? 0.5 : 1
                        }}>
                          <div style={{
                            fontSize: "3rem",
                            fontWeight: "700",
                            color: "#90caf9",
                            marginBottom: "0.5rem"
                          }}>
                            {lastNote || '--'}
                          </div>
                          <div style={{
                            fontSize: "1.2rem",
                            color: "#b0bec5"
                          }}>
                            {lastFrequency ? lastFrequency.toFixed(2) : '--'} Hz
                          </div>
                        </div>
                        
                        {/* Tuning indicator with rocket */}
                        <div style={{
                          marginBottom: "2rem"
                        }}>
                          <div style={{
                            position: "relative",
                            width: "200px",
                            height: "200px",
                            margin: "0 auto"
                          }}>
                            <svg
                              width="200"
                              height="200"
                              viewBox="0 0 200 200"
                              style={{
                                display: 'block',
                                margin: '0 auto'
                              }}
                            >
                              {/* Tuning tick marks (center tick is target) */}
                              <g>
                                {tickAngles.map((angle, i) => {
                                  const rad = (angle - 90) * Math.PI / 180;
                                  const r1 = 80, r2 = angle === 0 ? 60 : 70;
                                  const x1 = 100 + r1 * Math.cos(rad);
                                  const y1 = 100 + r1 * Math.sin(rad);
                                  const x2 = 100 + r2 * Math.cos(rad);
                                  const y2 = 100 + r2 * Math.sin(rad);
                                  return (
                                    <line
                                      key={angle}
                                      x1={x1}
                                      y1={y1}
                                      x2={x2}
                                      y2={y2}
                                      stroke={angle === 0 ? '#ffd700' : '#90caf9'}
                                      strokeWidth={angle === 0 ? 4 : 2}
                                      opacity={angle === 0 ? 1 : 0.7}
                                    />
                                  );
                                })}
                              </g>
                              {/* Rocket and flame group, which rotates */}
                              <g style={{
                                transform: `rotate(${rocketAngle}deg)`,
                                transformOrigin: '100px 100px',
                                transition: 'transform 0.15s cubic-bezier(.4,2,.6,1)'
                              }}>
                                {/* Rocket body */}
                                <rect x="85" y="60" width="30" height="80" rx="15" fill="#fff" stroke="#90caf9" strokeWidth="4"/>
                                {/* Rocket window */}
                                <ellipse cx="100" cy="90" rx="10" ry="15" fill="#90caf9" stroke="#fff" strokeWidth="2"/>
                                {/* Rocket nose cone */}
                                <polygon points="100,20 75,60 125,60" fill="#90caf9"/>
                                {/* Rocket fins */}
                                <polygon points="75,140 50,180 100,160" fill="#7e57c2"/>
                                <polygon points="125,140 150,180 100,160" fill="#7e57c2"/>
                                {/* Rocket flame */}
                                <g>
                                  <polygon
                                    points={`90,140 110,140 100,${180 + (lastFrequency ? Math.min(40, Math.max(0, (lastFrequency - 80) / 2)) : 20)}`}
                                    fill={
                                      lastFrequency
                                        ? lastFrequency < 120
                                          ? '#ff9800'
                                          : lastFrequency < 200
                                            ? '#ffd700'
                                            : '#4caf50'
                                        : '#ff9800'
                                    }
                                    style={{
                                      filter: 'drop-shadow(0 0 20px #ffd700) drop-shadow(0 0 40px #ff9800)',
                                      transition: 'all 0.2s'
                                    }}
                                  />
                                  {/* Inner flame for more effect */}
                                  <polygon
                                    points={`95,140 105,140 100,${160 + (lastFrequency ? Math.min(20, Math.max(0, (lastFrequency - 80) / 4)) : 10)}`}
                                    fill="#fff"
                                    opacity="0.7"
                                  />
                                </g>
                              </g>
                            </svg>
                          </div>
                          <div style={{
                            fontSize: "1.2rem",
                            fontWeight: "600",
                            color: tuningStatus === "In Tune" ? "#4caf50" : 
                                   tuningStatus === "Too Low" ? "#ff9800" : 
                                   tuningStatus === "Too High" ? "#f44336" : "#b0bec5"
                          }}>
                            {tuningStatus}
                          </div>
                        </div>
                        
                        {/* Digital frequency readout */}
                        <div style={{
                          background: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "12px",
                          padding: "1rem",
                          marginBottom: "2rem"
                        }}>
                          <span style={{ color: "#b0bec5" }}>Pitch: </span>
                          <span style={{ color: "#90caf9", fontWeight: "600" }}>
                            {frequency ? frequency.toFixed(2) : '--'} Hz
                          </span>
                        </div>
                      </>
                    ) : (
                      <div style={{
                        fontSize: "2rem",
                        color: "#b0bec5",
                        marginBottom: "2rem"
                      }}>
                        Listening...
                      </div>
                    )}
                  </div>
                  
                  {/* Controls */}
                  <div style={{
                    marginBottom: "2rem"
                  }}>
                    {!listening ? (
                      <button 
                        style={{
                          fontSize: "1.1rem",
                          padding: "0.8rem 2rem",
                          borderRadius: "50px",
                          border: "none",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          background: "linear-gradient(45deg, #1976d2, #7e57c2)",
                          color: "#fff",
                          boxShadow: "0 4px 15px rgba(25, 118, 210, 0.4)"
                        }}
                        onClick={start}
                      >
                        Start Tuner
                      </button>
                    ) : (
                      <button 
                        style={{
                          fontSize: "1.1rem",
                          padding: "0.8rem 2rem",
                          borderRadius: "50px",
                          border: "none",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          background: "linear-gradient(45deg, #e53935, #c62828)",
                          color: "#fff",
                          boxShadow: "0 4px 15px rgba(229, 57, 53, 0.4)"
                        }}
                        onClick={stop}
                      >
                        Stop Tuner
                      </button>
                    )}
                  </div>
                  
                  {error && (
                    <div style={{
                      background: "rgba(244, 67, 54, 0.2)",
                      color: "#f44336",
                      padding: "1rem",
                      borderRadius: "8px",
                      marginBottom: "2rem",
                      border: "1px solid rgba(244, 67, 54, 0.3)"
                    }}>
                      {error}
                    </div>
                  )}
                  
                  {/* String list */}
                  <div style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    borderRadius: "12px",
                    padding: "1.5rem",
                    border: "1px solid rgba(255, 255, 255, 0.1)"
                  }}>
                    <h4 style={{
                      fontSize: "1.2rem",
                      color: "#90caf9",
                      margin: "0 0 1rem 0",
                      textAlign: "center"
                    }}>
                      Standard Tuning
                    </h4>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "0.5rem"
                    }}>
                      {GUITAR_STRINGS.map(s => (
                        <div key={s.note} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "0.5rem",
                          background: "rgba(255, 255, 255, 0.05)",
                          borderRadius: "6px"
                        }}>
                          <span style={{ color: "#90caf9", fontWeight: "600" }}>{s.note}</span>
                          <span style={{ color: "#b0bec5" }}>{s.freq} Hz</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }}
          </AudioPitchDetector>
        </div>
      </div>
    </div>
  );
};

export default GuitarTuner; 