import React from "react";
import GuitarTuner from "../components/GuitarTuner";

function Tuner() {
  return (
    <div className="tuner-page-container">
      <h1 style={{ textAlign: 'center', margin: '2rem 0 1rem 0' }}>Guitar Tuner</h1>
      <GuitarTuner />
    </div>
  );
}

export default Tuner; 