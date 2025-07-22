import React, { useState, useRef } from "react";
import PlayAlongOverlay from "../components/PlayAlongOverlay";

const ARPEGGIOS = {
  "C Major Triad": [
    { stringIdx: 4, fretNum: 3, note: "C", isRoot: true }, // 3rd fret, 5th string (A string)
    { stringIdx: 3, fretNum: 2, note: "E" },               // 2nd fret, 4th string (D string)
    { stringIdx: 2, fretNum: 0, note: "G" },               // open 3rd string (G string)
  ],
  "D Major Triad": [
    { stringIdx: 3, fretNum: 0, note: "D", isRoot: true }, // open 4th string (D string)
    { stringIdx: 2, fretNum: 2, note: "A" },               // 2nd fret, 3rd string (G string)
    { stringIdx: 1, fretNum: 3, note: "F#" },              // 3rd fret, 2nd string (B string)
  ],
  "G Major Triad": [
    { stringIdx: 4, fretNum: 2, note: "B" },               // 2nd fret, 5th string (A string)
    { stringIdx: 3, fretNum: 0, note: "D" },               // open 4th string (D string)
    { stringIdx: 2, fretNum: 0, note: "G", isRoot: true }, // open 3rd string (G string)
  ],
};

function PlayAlong() {
  const [selectedArpeggio, setSelectedArpeggio] = useState("C Major Triad");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const playTimer = useRef(null);

  const arpeggioSteps = ARPEGGIOS[selectedArpeggio];
  const currentStep = arpeggioSteps[currentStepIdx] || null;

  const startPlayback = () => {
    setIsPlaying(true);
    setCurrentStepIdx(0);
    playTimer.current = setInterval(() => {
      setCurrentStepIdx(idx => {
        if (idx < arpeggioSteps.length - 1) {
          return idx + 1;
        } else {
          clearInterval(playTimer.current);
          setIsPlaying(false);
          return idx;
        }
      });
    }, 1200); // 1.2s per note for demo
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    clearInterval(playTimer.current);
  };

  return (
    <div style={{ textAlign: "center", color: "#fff", background: "#181c24", minHeight: "100vh", paddingTop: 40 }}>
      <h2>Play Along</h2>
      <div style={{ margin: "2em" }}>
        <label htmlFor="arpeggio">Choose Arpeggio: </label>
        <select
          id="arpeggio"
          value={selectedArpeggio}
          onChange={e => setSelectedArpeggio(e.target.value)}
          style={{ fontSize: "1.1em", padding: "0.3em 1em" }}
          disabled={isPlaying}
        >
          {Object.keys(ARPEGGIOS).map(name => (
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
          highlightedNotes={isPlaying && currentStep ? [{ fretNum: currentStep.fretNum, stringIdx: currentStep.stringIdx }] : []}
          arpeggioNotes={arpeggioSteps}
          currentStep={currentStepIdx}
        />
      </div>
      <div style={{ fontSize: "1.5em", marginTop: "2em" }}>
        {isPlaying && currentStep
          ? `Now playing: ${currentStep.note} (String ${currentStep.stringIdx + 1}, Fret ${currentStep.fretNum})`
          : !isPlaying
          ? "Ready to play."
          : "Done!"}
      </div>
    </div>
  );
}

export default PlayAlong; 