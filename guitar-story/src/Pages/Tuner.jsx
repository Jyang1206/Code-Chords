import React from "react";
import GuitarTuner from "../components/GuitarTuner";

function Tuner() {
  return (
    <div className="tuner-page">
      <header className="page-head">
        <h1>Tuner</h1>
        <p>Press start, pluck one open string, and turn the peg until the needle settles in the centre.</p>
      </header>
      <GuitarTuner />
    </div>
  );
}

export default Tuner;
