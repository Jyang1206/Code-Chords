import React, { useState, useRef } from "react";
import PlayAlongOverlay from "../components/PlayAlongOverlay";

const CHORDS_ORIGINAL = {
  "C Major": [
    { stringIdx: 1, fretNum: 3 }, // 5th string (A)
    { stringIdx: 2, fretNum: 2 }, // 4th string (D)
    { stringIdx: 3, fretNum: 0 }, // 3rd string (G)
    { stringIdx: 4, fretNum: 1 }, // 2nd string (B)
    { stringIdx: 5, fretNum: 0 }, // 1st string (high E)
  ],
  "G Major": [
    { stringIdx: 0, fretNum: 3 }, // 6th string (low E)
    { stringIdx: 1, fretNum: 2 }, // 5th string (A)
    { stringIdx: 2, fretNum: 0 }, // 4th string (D)
    { stringIdx: 3, fretNum: 0 }, // 3rd string (G)
    { stringIdx: 4, fretNum: 0 }, // 2nd string (B)
    { stringIdx: 5, fretNum: 3 }, // 1st string (high E)
  ],
  "E Major": [
    { stringIdx: 0, fretNum: 0 }, // 6th string (low E)
    { stringIdx: 1, fretNum: 2 }, // 5th string (A)
    { stringIdx: 2, fretNum: 2 }, // 4th string (D)
    { stringIdx: 3, fretNum: 1 }, // 3rd string (G)
    { stringIdx: 4, fretNum: 0 }, // 2nd string (B)
    { stringIdx: 5, fretNum: 0 }, // 1st string (high E)
  ],
  "A Major": [
    { stringIdx: 0, fretNum: 0 }, // 6th string (low E)
    { stringIdx: 1, fretNum: 0 }, // 5th string (A)
    { stringIdx: 2, fretNum: 2 }, // 4th string (D)
    { stringIdx: 3, fretNum: 2 }, // 3rd string (G)
    { stringIdx: 4, fretNum: 2 }, // 2nd string (B)
    { stringIdx: 5, fretNum: 0 }, // 1st string (high E)
  ],
  "D Major": [
    { stringIdx: 0, fretNum: 0, mute: true }, // 6th string (low E, not played)
    { stringIdx: 1, fretNum: 0, mute: true }, // 5th string (A, not played)
    { stringIdx: 2, fretNum: 0 }, // 4th string (D)
    { stringIdx: 3, fretNum: 2 }, // 3rd string (G)
    { stringIdx: 4, fretNum: 3 }, // 2nd string (B)
    { stringIdx: 5, fretNum: 2 }, // 1st string (high E)
  ],
};

const CHORDS = Object.fromEntries(
  Object.entries(CHORDS_ORIGINAL).map(([chord, notes]) => [
    chord,
    notes
      .filter(n => !n.mute)
      .map(n => ({ ...n, stringIdx: 5 - n.stringIdx }))
  ])
);

function PlayAlong() {
  const [selectedChord, setSelectedChord] = useState("C Major");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const playTimer = useRef(null);

  const chordNotes = CHORDS[selectedChord];
  const currentStep = chordNotes[currentStepIdx] || null;

  const startPlayback = () => {
    setIsPlaying(true);
    setCurrentStepIdx(0);
    playTimer.current = setInterval(() => {
      setCurrentStepIdx(idx => {
        if (idx < chordNotes.length - 1) {
          return idx + 1;
        } else {
          clearInterval(playTimer.current);
          setIsPlaying(false);
          return idx;
        }
      });
    }, 1200);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    clearInterval(playTimer.current);
  };

  return (
    <div style={{ textAlign: "center", color: "#fff", background: "#181c24", minHeight: "100vh", paddingTop: 40 }}>
      <h2>Play Along</h2>
      <div style={{ margin: "2em" }}>
        <label htmlFor="chord">Choose Chord: </label>
        <select
          id="chord"
          value={selectedChord}
          onChange={e => setSelectedChord(e.target.value)}
          style={{ fontSize: "1.1em", padding: "0.3em 1em" }}
          disabled={isPlaying}
        >
          {Object.keys(CHORDS).map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <button
          style={{ fontSize: "1.2em", padding: "0.5em 2em", margin: "1em" }}
          onClick={startPlayback}
          disabled={isPlaying}
        >
          Play
        </button>
        <button
          style={{ fontSize: "1.2em", padding: "0.5em 2em", margin: "1em" }}
          onClick={stopPlayback}
          disabled={!isPlaying}
        >
          Stop
        </button>
      </div>
      <div style={{ position: "relative", width: 640, height: 480, margin: "0 auto" }}>
        <PlayAlongOverlay
          highlightedNotes={isPlaying && currentStep ? [currentStep] : []}
          arpeggioNotes={chordNotes}
          currentStep={isPlaying ? currentStepIdx : -1}
        />
      </div>
      <div style={{ fontSize: "1.5em", marginTop: "2em" }}>
        {isPlaying && currentStep
          ? `Now playing: String ${6 - currentStep.stringIdx} Fret ${currentStep.fretNum}`
          : selectedChord}
      </div>
    </div>
  );
}

export default PlayAlong; 