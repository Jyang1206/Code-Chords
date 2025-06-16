import React, { useState } from 'react';
import { Camera } from './components/Camera';
import './App.css';

function App() {
  const [currentScale, setCurrentScale] = useState(null);

  return (
    <div className="app">
      <header>
        <h1>Guitar Story</h1>
        <p>Real-time fretboard visualization and scale learning</p>
      </header>
      
      <main>
        <Camera
          apiKey="PXAqQENZCRpDPtJ8rd4w"
          modelId="guitar-frets-segmenter/1"
          onScaleChange={setCurrentScale}
        />
        
        {currentScale && (
          <div className="scale-info">
            <h2>Current Scale</h2>
            <p>Root: {currentScale.root}</p>
            <p>Type: {currentScale.scaleName}</p>
            <p>Notes: {currentScale.notes.join(', ')}</p>
          </div>
        )}
      </main>
      
      <footer>
        <p>Built with React and Roboflow</p>
      </footer>
    </div>
  );
}

export default App;
