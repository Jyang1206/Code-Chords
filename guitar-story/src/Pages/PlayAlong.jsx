import React, { useState, useRef, useEffect } from "react";
import PlayAlongOverlay from "../components/PlayAlongOverlay";
import { useAuth } from "../contexts/AuthContext";
import { ScoreboardService } from "../services/scoreboardService";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const CHORDS_ORIGINAL = {
  "C Major": [
    { stringIdx: 5, fretNum: 3, note: "C", isRoot: true }, // 5th string
    { stringIdx: 4, fretNum: 2, note: "E" },               // 4th string
    { stringIdx: 3, fretNum: 0, note: "G" },               // 3rd string
    { stringIdx: 2, fretNum: 1, note: "C" },               // 2nd string
    { stringIdx: 1, fretNum: 0, note: "E" },               // 1st string
  ],
  "G Major": [
    { stringIdx: 6, fretNum: 3, note: "G", isRoot: true }, // 6th string
    { stringIdx: 5, fretNum: 2, note: "B" },               // 5th string
    { stringIdx: 4, fretNum: 0, note: "D" },               // 4th string
    { stringIdx: 3, fretNum: 0, note: "G" },               // 3rd string
    { stringIdx: 2, fretNum: 0, note: "B" },               // 2nd string
    { stringIdx: 1, fretNum: 3, note: "G" },               // 1st string
  ],
  "E Major": [
    { stringIdx: 6, fretNum: 0, note: "E", isRoot: true }, // 6th string
    { stringIdx: 5, fretNum: 2, note: "A" },               // 5th string
    { stringIdx: 4, fretNum: 2, note: "B" },               // 4th string
    { stringIdx: 3, fretNum: 1, note: "E" },               // 3rd string
    { stringIdx: 2, fretNum: 0, note: "B" },               // 2nd string
    { stringIdx: 1, fretNum: 0, note: "E" },               // 1st string
  ],
  "A Major": [
    { stringIdx: 6, fretNum: 0, note: "E", mute: true },   // 6th string (not played)
    { stringIdx: 5, fretNum: 0, note: "A", isRoot: true }, // 5th string
    { stringIdx: 4, fretNum: 2, note: "D" },               // 4th string
    { stringIdx: 3, fretNum: 2, note: "F#" },              // 3rd string
    { stringIdx: 2, fretNum: 2, note: "A" },               // 2nd string
    { stringIdx: 1, fretNum: 0, note: "E" },               // 1st string
  ],
  "D Major": [
    { stringIdx: 6, fretNum: 0, note: "E", mute: true },   // 6th string (not played)
    { stringIdx: 5, fretNum: 0, note: "A", mute: true },   // 5th string (not played)
    { stringIdx: 4, fretNum: 0, note: "D", isRoot: true }, // 4th string
    { stringIdx: 3, fretNum: 2, note: "A" },               // 3rd string
    { stringIdx: 2, fretNum: 3, note: "F#" },              // 2nd string
    { stringIdx: 1, fretNum: 2, note: "D" },               // 1st string
  ],
};

// Remove the mapping since CHORDS_ORIGINAL now uses 0-5 indexing
const CHORDS = Object.fromEntries(
  Object.entries(CHORDS_ORIGINAL).map(([chord, notes]) => [
    chord,
    notes.filter(n => !n.mute)
  ])
);

// --- SONGS DATA ---
const SONGS = {
  "Ode to Joy": [
    //1 to 6 indexing, 6th string is the lowest E, 1st string is the highest E
    { stringIdx: 2, fretNum: 0, note: "B", duration: 1 }, // 2nd string
    { stringIdx: 2, fretNum: 0, note: "B", duration: 1 }, // 2nd string
    { stringIdx: 2, fretNum: 1, note: "C", duration: 1 }, // 2nd string
    { stringIdx: 2, fretNum: 3, note: "D", duration: 1 }, // 2nd string
    { stringIdx: 2, fretNum: 3, note: "D", duration: 1 }, // 2nd string
    { stringIdx: 2, fretNum: 1, note: "C", duration: 1 }, // 2nd string
    { stringIdx: 2, fretNum: 0, note: "B", duration: 1 }, // 2nd string
    { stringIdx: 3, fretNum: 2, note: "A", duration: 1 }, // 3rd string
    { stringIdx: 3, fretNum: 0, note: "G", duration: 1 }, // 3rd string
    { stringIdx: 3, fretNum: 0, note: "G", duration: 1 }, // 3rd string
    { stringIdx: 3, fretNum: 2, note: "A", duration: 1 }, // 3rd string
    { stringIdx: 3, fretNum: 4, note: "B", duration: 1 }, // 3rd string
    { stringIdx: 3, fretNum: 4, note: "B", duration: 2 }, // 3rd string
    { stringIdx: 3, fretNum: 2, note: "A", duration: 0.5 }, // 3rd string
    { stringIdx: 3, fretNum: 2, note: "A", duration: 0.5 }, // 3rd string
  ],
  "Twinkle Twinkle Little Star": [
    //1 to 6 indexing, 6th string is the lowest E, 1st string is the highest E
    { stringIdx: 4, fretNum: 0, note: "D", duration: 1 }, // 4th string
    { stringIdx: 4, fretNum: 0, note: "D", duration: 1 }, // 4th string
    { stringIdx: 3, fretNum: 2, note: "A", duration: 1 }, // 3rd string
    { stringIdx: 3, fretNum: 2, note: "A", duration: 1 }, // 3rd string
    { stringIdx: 3, fretNum: 0, note: "B", duration: 1 }, // 3rd string
    { stringIdx: 3, fretNum: 0, note: "B", duration: 1 }, // 3rd string
    { stringIdx: 3, fretNum: 2, note: "A", duration: 2 }, // 3rd string
    // ...
  ]
};

// --- TAB OVERLAY COMPONENT ---
const TabOverlay = ({ playNotes, currentStepIdx, isPlaying }) => {
  const upcomingNotes = playNotes.slice(currentStepIdx, currentStepIdx + 5); // Show next 5 notes
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '12px',
      padding: '12px 20px',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(144, 202, 249, 0.3)',
      zIndex: 1000,
      minWidth: '300px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <div style={{
        fontSize: '14px',
        color: '#90caf9',
        fontWeight: '600',
        marginRight: '8px'
      }}>
        Next:
      </div>
      {upcomingNotes.map((note, index) => (
        <div
          key={`${currentStepIdx + index}-${note.stringIdx}-${note.fretNum}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 12px',
            background: index === 0 ? 'rgba(144, 202, 249, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            border: index === 0 ? '2px solid #90caf9' : '1px solid rgba(255, 255, 255, 0.2)',
            minWidth: '40px',
            transition: 'all 0.3s ease',
            opacity: index === 0 ? 1 : 0.7
          }}
        >
          <div style={{
            fontSize: '16px',
            fontWeight: '700',
            color: index === 0 ? '#fff' : '#90caf9',
            marginBottom: '2px'
          }}>
            {note.note}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#ccc',
            fontWeight: '500',
            marginBottom: '2px'
          }}>
            {note.stringIdx}-{note.fretNum}
          </div>
          <div style={{
            fontSize: '10px',
            color: '#888',
            fontWeight: '400'
          }}>
            {(note.duration || 1).toFixed(1)}s
          </div>
        </div>
      ))}
      {upcomingNotes.length < 5 && (
        <div style={{
          fontSize: '14px',
          color: '#666',
          fontStyle: 'italic',
          marginLeft: '8px'
        }}>
          End
        </div>
      )}
    </div>
  );
};

  // --- GUITAR HERO INTERFACE COMPONENT ---
  const GuitarHeroInterface = ({ playNotes, currentStepIdx, isPlaying, playbackStartTimeRef, playbackTime, firstNoteTravelIn = 0 }) => {
    const STRING_COUNT = 6;
    const FRET_COUNT = 12;
    const NOTE_WIDTH = 44; // Slightly smaller
    const NOTE_HEIGHT = 28; // Slightly smaller
    const STRING_HEIGHT = 30;
    const FRET_WIDTH = 60;
    const SPAWN_X = 1000; // Right side spawn point
    const PLAY_ZONE_X = 100; // Left side Play zone
    const TRAVEL_DISTANCE = SPAWN_X - PLAY_ZONE_X;

    // Calculate visible notes with precise travel
    const getVisibleNotes = () => {
      if (!isPlaying || !playbackStartTimeRef.current) return [];
      const now = playbackTime;
      const visibleNotes = [];
      const TRAVEL_TIME = 1200; // 1.0s travel time
      let cumulativeTime = 0;
      
      for (let i = 0; i < playNotes.length; i++) {
        const note = playNotes[i];
        const duration = (note.duration || 1) * 1200; // Duration in ms
        
        // Each note spawns at cumulativeTime and takes TRAVEL_TIME to reach Play
        const noteSpawnTime = cumulativeTime;
        const notePlayTime = noteSpawnTime + TRAVEL_TIME;
        const timeUntilPlay = notePlayTime - now;
        
        // Show note if it's within the travel window
        if (timeUntilPlay <= TRAVEL_TIME && timeUntilPlay >= -1000) {
          // progress: 1 (spawn, right), 0 (at Play zone, left)
          const progress = Math.max(0, Math.min(1, timeUntilPlay / TRAVEL_TIME));
          const xPosition = SPAWN_X - (TRAVEL_DISTANCE * (1 - progress));
          const y = (STRING_COUNT - note.stringIdx) * STRING_HEIGHT + 10 - NOTE_HEIGHT / 2 + 1;
          const isCurrent = Math.abs(timeUntilPlay) < 200;
          visibleNotes.push({
            ...note,
            x: xPosition,
            y,
            isCurrent,
            progress,
            timeUntilPlay
          });
        }
        
        // Next note spawns after current note's duration
        cumulativeTime += duration;
      }
      
      return visibleNotes;
    };
    const visibleNotes = getVisibleNotes();
    const playZoneHeight = STRING_COUNT * STRING_HEIGHT;
    const playZoneTop = 10;
    return (
      <div style={{
        position: 'relative',
        width: `${SPAWN_X + 200}px`,
        height: `${STRING_COUNT * STRING_HEIGHT + 20}px`,
        background: 'linear-gradient(180deg, #1a1b2e 0%, #0a0a0a 100%)',
        border: '2px solid rgba(144, 202, 249, 0.3)',
        borderRadius: '12px',
        overflow: 'hidden',
        margin: '32px auto 0 auto'
      }}>
        {/* Guitar strings */}
        {Array.from({ length: STRING_COUNT }, (_, i) => (
          <div
            key={`string-${i}`}
            style={{
              position: 'absolute',
              left: 0,
              top: i * STRING_HEIGHT + 10,
              width: '100%',
              height: '2px',
              background: i === 0 || i === 5 ? '#90caf9' : '#444',
              zIndex: 1
            }}
          />
        ))}
        {/* Fret markers */}
        {Array.from({ length: FRET_COUNT }, (_, i) => (
          <div
            key={`fret-${i}`}
            style={{
              position: 'absolute',
              left: 50 + i * FRET_WIDTH,
              top: 0,
              width: '2px',
              height: '100%',
              background: i === 3 || i === 5 || i === 7 || i === 9 ? '#90caf9' : '#333',
              zIndex: 1
            }}
          />
        ))}
        {/* Play zone on the left */}
        <div style={{
          position: 'absolute',
          left: PLAY_ZONE_X - 25,
          top: 0,
          width: '50px',
          height: `${playZoneHeight}px`,
          border: '3px solid #90caf9',
          borderRadius: '25px',
          background: 'rgba(144, 202, 249, 0.1)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#90caf9',
            fontWeight: 'bold',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)'
          }}>
            PLAY
          </div>
        </div>
        {/* Moving notes */}
        {visibleNotes.map((note, index) => (
          <div
            key={`note-${index}`}
            style={{
              position: 'absolute',
              left: note.x,
              top: note.y,
              width: NOTE_WIDTH,
              height: NOTE_HEIGHT,
              background: note.isCurrent ? '#90caf9' : '#222',
              borderRadius: '8px',
              border: note.isCurrent ? '3px solid #fff' : '2px solid #90caf9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: note.isCurrent ? '#222' : '#90caf9',
              fontSize: '1.3rem',
              fontWeight: 'bold',
              zIndex: 5,
              boxShadow: note.isCurrent ? '0 0 20px 4px #90caf9' : '0 0 8px #222',
              transform: note.isCurrent ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.1s, background 0.2s, color 0.2s, border 0.2s'
            }}
          >
            {note.fretNum}
          </div>
        ))}
        {/* String labels */}
        {Array.from({ length: STRING_COUNT }, (_, i) => (
          <div
            key={`label-${i}`}
            style={{
              position: 'absolute',
              left: 10,
              top: i * STRING_HEIGHT + 5,
              color: '#90caf9',
              fontSize: '14px',
              fontWeight: 'bold',
              zIndex: 2
            }}
          >
            {STRING_COUNT - i}
          </div>
        ))}
        {/* Fret labels */}
        {Array.from({ length: FRET_COUNT }, (_, i) => (
          <div
            key={`fret-label-${i}`}
            style={{
              position: 'absolute',
              left: 50 + i * FRET_WIDTH - 10,
              top: 5,
              color: '#666',
              fontSize: '11px',
              zIndex: 2
            }}
          >
            {i}
          </div>
        ))}
      </div>
    );
  };

function PlayAlong() {
  console.log('PlayAlong component is rendering!');
  const { currentUser } = useAuth();
  const [mainMode, setMainMode] = useState("Chords"); // "Chords" or "Songs"
  const [selectedChord, setSelectedChord] = useState("C Major");
  const [selectedSong, setSelectedSong] = useState("Ode to Joy");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [chordAccuracy, setChordAccuracy] = useState(0);
  const [completedNotes, setCompletedNotes] = useState(new Set()); // Track which notes have been completed
  const playTimer = useRef(null);
  const latestSessionStatsRef = useRef({ correct: 0, total: 0 }); // Track latest session stats
  const noteTimestampsRef = useRef({}); // Track timestamps for song playback

  // Add countdown state
  const [countdown, setCountdown] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  // Let the last note linger before stopping overlay
  const [overlayActive, setOverlayActive] = useState(true);
  useEffect(() => {
    if (!isPlaying && overlayActive) {
      // Wait 2s after last note before hiding overlay
      const timeout = setTimeout(() => setOverlayActive(false), 2000);
      return () => clearTimeout(timeout);
    }
    if (isPlaying && !overlayActive) {
      setOverlayActive(true);
    }
  }, [isPlaying, overlayActive]);
  const [animationTime, setAnimationTime] = useState(Date.now());
  const [visualFeedback, setVisualFeedback] = useState(null);

  // Clear visual feedback after 1.5 seconds
  useEffect(() => {
    if (visualFeedback) {
      const timer = setTimeout(() => {
        setVisualFeedback(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [visualFeedback]);

  // Add playbackStartTime ref
  const playbackStartTimeRef = useRef(null);

  // Animation loop for global timing
  useEffect(() => {
    let raf;
    const update = () => {
      setAnimationTime(Date.now());
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Calculate global playbackTime (ms since playback started, no delay)
  const playbackTime =
    isPlaying && playbackStartTimeRef.current
      ? Math.max(0, animationTime - playbackStartTimeRef.current)
      : 0;

  // Determine which notes to use: arpeggio or song
  const playNotes = mainMode === 'Chords' ? CHORDS[selectedChord] : SONGS[selectedSong];
  const isChordMode = mainMode === "Chords";
  const isSongMode = mainMode === "Songs";
  const currentStep = playNotes[currentStepIdx] || null;

  // Calculate currentStepIdx based on playbackTime (moved after playNotes is defined)
  const getCurrentStepIdx = () => {
    let time = 0;
    for (let i = 0; i < playNotes.length; i++) {
      const duration = (playNotes[i].duration || 1) * 1200;
      if (playbackTime < time + duration) return i;
      time += duration;
    }
    return playNotes.length - 1;
  };
  const syncedStepIdx = getCurrentStepIdx();

  // Calculate delayed step index for overlay (1 second delay to account for travel time)
  const getDelayedStepIdx = () => {
    const delayedPlaybackTime = Math.max(0, playbackTime - 1000); // 1 second delay
    let time = 0;
    for (let i = 0; i < playNotes.length; i++) {
      const duration = (playNotes[i].duration || 1) * 1200;
      if (delayedPlaybackTime < time + duration) return i;
      time += duration;
    }
    return playNotes.length - 1;
  };
  const delayedStepIdx = getDelayedStepIdx();

  // Update currentStepIdx for scoring logic
  useEffect(() => {
    if (isPlaying) setCurrentStepIdx(syncedStepIdx);
  }, [isPlaying, syncedStepIdx]);

  // Reset completed notes and session stats when mode, chord, or song changes
  useEffect(() => {
    setCompletedNotes(new Set());
    const newSessionStats = { correct: 0, total: playNotes.length };
    setSessionStats(newSessionStats);
    latestSessionStatsRef.current = newSessionStats;
    setChordAccuracy(0);
    setCurrentScore(0);
  }, [mainMode, selectedChord, selectedSong]);

  // Calculate accuracy based on current chord's total notes
  const calculateAccuracy = (correct, totalNotes) => {
    if (totalNotes === 0) return 0;
    return Math.round((correct / totalNotes) * 100);
  };

  // Handle correct note played with timing-based scoring
  const handleCorrectNote = async (timingAccuracy = 0) => {
    if (!currentUser) return;
    
    // Create a unique identifier for this note (stringIdx + fretNum combination)
    const noteId = `${currentStep.stringIdx}-${currentStep.fretNum}`;
    
    // Add cooldown to prevent double-counting
    const now = Date.now();
    if (noteTimestampsRef.current[noteId] && now - noteTimestampsRef.current[noteId] < 500) {
      console.log(`[COOLDOWN] Note ${noteId} was recently played, skipping`);
      return;
    }
    noteTimestampsRef.current[noteId] = now;
    
    // Debug logging for C Major
    if (selectedChord === "C Major") {
      console.log(`[C MAJOR DEBUG] Current step:`, currentStep);
      console.log(`[C MAJOR DEBUG] Note ID: ${noteId}`);
      console.log(`[C MAJOR DEBUG] Completed notes:`, Array.from(completedNotes));
      console.log(`[C MAJOR DEBUG] Session stats:`, sessionStats);
    }
    
    // Only count this note if it hasn't been completed yet
    if (completedNotes.has(noteId)) {
      console.log(`Note ${noteId} already completed, skipping`);
      return;
    }
    
    // Calculate timing-based score
    let scorePoints = 10; // Base points
    let timingBonus = 0;
    let timingFeedback = "Good";
    let feedbackColor = "#4caf50"; // Default green
    
    if (timingAccuracy !== 0) {
      const absTiming = Math.abs(timingAccuracy);
      if (absTiming <= 10) { // Perfect timing (±10ms)
        timingBonus = 15;
        timingFeedback = "Perfect!";
        feedbackColor = "#006400"; // Dark green
        scorePoints += timingBonus;
      } else if (absTiming <= 20) { // Excellent timing (±20ms)
        timingBonus = 12;
        timingFeedback = "Excellent!";
        feedbackColor = "#4caf50"; // Green
        scorePoints += timingBonus;
      } else if (absTiming <= 40) { // Good timing (±40ms)
        timingBonus = 8;
        timingFeedback = "Good!";
        feedbackColor = "#2196f3"; // Blue
        scorePoints += timingBonus;
      } else if (absTiming <= 80) { // Okay timing (±80ms)
        timingBonus = 3;
        timingFeedback = "Okay";
        feedbackColor = "#ffeb3b"; // Yellow
        scorePoints += timingBonus;
      } else if (absTiming <= 100) { // Miss timing (±100ms)
        timingFeedback = "Miss";
        feedbackColor = "#ff5722"; // Light red
        // No bonus for miss timing
      } else { // Very late timing (>100ms)
        timingFeedback = "Too Late";
        feedbackColor = "#f44336"; // Red
        // No bonus for very late timing
      }
    }
    
    console.log(`[SCORE DEBUG] Correct note detected: ${noteId}, timing: ${timingAccuracy}ms, feedback: ${timingFeedback}, total points: ${scorePoints}`);
    
    const newScore = currentScore + scorePoints;
    setCurrentScore(newScore);
    
    // Update session stats for this chord
    const newCorrect = sessionStats.correct + 1;
    const totalNotesInChord = playNotes.length;
    const newAccuracy = calculateAccuracy(newCorrect, totalNotesInChord);
    
    console.log(`Correct note ${noteId}! Progress: ${newCorrect}/${totalNotesInChord} (${newAccuracy}%)`);
    
    // Mark this note as completed using the unique identifier
    setCompletedNotes(prev => new Set([...prev, noteId]));
    
    setSessionStats(prev => {
      const newStats = {
        correct: newCorrect,
        total: totalNotesInChord
      };
      latestSessionStatsRef.current = newStats; // Update ref with latest stats
      return newStats;
    });
    
    setChordAccuracy(newAccuracy);

    // Show visual feedback
    setVisualFeedback({
      type: 'correct',
      message: timingFeedback,
      points: scorePoints,
      timing: timingAccuracy,
      color: feedbackColor
    });

    // Save individual score entry (for tracking purposes)
    try {
      console.log(`[DB DEBUG] Adding individual score:`, {
        uid: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email.split('@')[0] || 'Anonymous',
        score: scorePoints,
        chord: selectedChord,
        isCorrect: true,
        timingAccuracy: timingAccuracy
      });
      
      const result = await ScoreboardService.addScore(
        currentUser.uid,
        currentUser.displayName || currentUser.email.split('@')[0] || 'Anonymous',
        scorePoints,
        selectedChord,
        true
      );
      
      if (!result.success) {
        console.warn('Individual score not saved to database:', result.error);
      } else {
        console.log('Individual score saved to database successfully');
      }
    } catch (error) {
      console.error('Error adding individual score:', error);
    }
  };

  // Handle incorrect note played
  const handleIncorrectNote = () => {
    // Create a unique identifier for this note (stringIdx + fretNum combination)
    const noteId = `${currentStep.stringIdx}-${currentStep.fretNum}`;
    
    // Only count this note if it hasn't been completed yet
    if (completedNotes.has(noteId)) {
      console.log(`Note ${noteId} already completed, skipping incorrect`);
      return;
    }
    
    // Mark this note as completed (but incorrect)
    setCompletedNotes(prev => new Set([...prev, noteId]));
    
    // Don't increment correct count, but still track total attempts
    const totalNotesInChord = playNotes.length;
    const currentCorrect = sessionStats.correct;
    const newAccuracy = calculateAccuracy(currentCorrect, totalNotesInChord);
    
    console.log(`Incorrect note ${noteId}, accuracy: ${newAccuracy}% (${currentCorrect}/${totalNotesInChord})`);
    setChordAccuracy(newAccuracy);
    
    // Show visual feedback for incorrect note
    setVisualFeedback({
      type: 'incorrect',
      message: 'Wrong Note',
      points: 0,
      timing: 0,
      color: '#f44336'
    });
    
    // Also send incorrect note to database (with 0 points)
    if (currentUser) {
      ScoreboardService.addScore(
        currentUser.uid,
        currentUser.displayName || currentUser.email.split('@')[0] || 'Anonymous',
        0,
        selectedChord,
        false
      );
    }
  };

  // Update startPlayback to set playbackStartTime
  const startPlayback = () => {
    if (!playNotes || playNotes.length === 0) return;
    setShowCountdown(true);
    setCountdown(3);
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setShowCountdown(false);
          // Set playback start time to now (no delay)
          playbackStartTimeRef.current = Date.now();
          setIsPlaying(true);
          setCurrentStepIdx(0);
          setSessionStats({ correct: 0, total: 0 });
          setChordAccuracy(0);
          setCurrentScore(0);
          completedNotes.current = new Set();
          noteTimestampsRef.current = {};
          // Start the note progression
          playNextNote(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const playNextNote = (stepIdx) => {
    if (stepIdx >= playNotes.length) {
      // Playback complete - wait for last note to finish traveling
      setTimeout(() => {
        setIsPlaying(false);
        updateFinalScoreboard();
      }, 1500); // Wait 1.5s for last note to complete travel
      return;
    }

    setCurrentStepIdx(stepIdx);
    const currentNote = playNotes[stepIdx];
    const durationMs = (currentNote.duration || 1) * 1200;
    
    // Schedule next note
    setTimeout(() => {
      playNextNote(stepIdx + 1);
    }, durationMs);
  };

  // Update final scoreboard when chord is completed
  const updateFinalScoreboard = async () => {
    if (!currentUser) return;
    
    // Use the latest session stats from the ref to ensure we have the most current data
    const latestStats = latestSessionStatsRef.current;
    const finalAccuracy = calculateAccuracy(latestStats.correct, latestStats.total);
    const bonusPoints = Math.round((finalAccuracy / 100) * 50); // Bonus points based on accuracy
    const totalPoints = currentScore + bonusPoints;
    const chordLength = playNotes.length; // Total notes in the chord
    
    console.log(`Chord completed! Final stats: ${latestStats.correct}/${latestStats.total} (${finalAccuracy}%), Total points: ${totalPoints}, Chord length: ${chordLength}`);
    
    console.log(`[DB DEBUG] Updating final scoreboard:`, {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email.split('@')[0] || 'Anonymous',
      correctNotes: latestStats.correct,
      totalNotes: chordLength,
      totalPoints: totalPoints,
      sessionStats: latestStats
    });
    
    try {
      // Use session data to update stats correctly
      // Always use chord length for total notes, regardless of how many were played
      const result = await ScoreboardService.updateUserStatsWithSessionData(
        currentUser.uid,
        currentUser.displayName || currentUser.email.split('@')[0] || 'Anonymous',
        latestStats.correct, // Use the correct count from latest session stats
        chordLength,          // Always use chord length for total notes
        totalPoints
      );
      
      if (result.success) {
        console.log('Final scoreboard updated with session data successfully');
        console.log('Updated stats:', result.data);
      } else {
        console.error('Failed to update scoreboard:', result.error);
      }
    } catch (error) {
      console.error('Error updating final scoreboard:', error);
    }
  };

  // Test database connection
  const testDatabaseConnection = async () => {
    if (!currentUser) {
      console.log('No user logged in');
      return;
    }
    
    try {
      console.log('Testing database connection...');
      console.log('User:', currentUser.email, 'UID:', currentUser.uid);
      
      // Ensure leaderboard exists
      await ScoreboardService.ensureLeaderboardExists();
      
      // Test 1: Add a score
      const result = await ScoreboardService.addScore(
        currentUser.uid,
        currentUser.email || 'Anonymous',
        5,
        'test-chord',
        true
      );
      console.log('Score add result:', result);
      
      // Test 2: Get user stats
      const statsResult = await ScoreboardService.getUserStats(currentUser.uid);
      console.log('User stats result:', statsResult);
      
      // Test 3: Subscribe to leaderboard
      const unsubscribe = ScoreboardService.subscribeToLeaderboard((leaderboardResult) => {
        console.log('Leaderboard subscription result:', leaderboardResult);
        unsubscribe();
      });
      
    } catch (error) {
      console.error('Database test failed:', error);
    }
  };

  // Test leaderboard update manually
  const testLeaderboardUpdate = async () => {
    if (!currentUser) {
      console.log('No user logged in');
      return;
    }
    
    try {
      console.log('Testing leaderboard update...');
      
      // Ensure leaderboard exists
      await ScoreboardService.ensureLeaderboardExists();
      
      // Manually update leaderboard
      await ScoreboardService.updateLeaderboard(currentUser.uid, currentUser.email || 'Anonymous', 25, 80, 4, 5);
      
      // Subscribe to see the update
      const unsubscribe = ScoreboardService.subscribeToLeaderboard((result) => {
        console.log('Leaderboard after manual update:', result);
        unsubscribe();
      });
      
    } catch (error) {
      console.error('Leaderboard test failed:', error);
    }
  };

  // Create leaderboard with test data
  const createLeaderboardWithTestData = async () => {
    if (!currentUser) {
      console.log('No user logged in');
      return;
    }
    
    try {
      console.log('Creating leaderboard with test data...');
      
      // Create leaderboard with test users
      const leaderboardRef = doc(db, 'scoreboard-db', 'leaderboard');
      await setDoc(leaderboardRef, {
        scores: [
          {
            userId: 'test-user-1',
            userName: 'Test User 1',
            totalScore: 100,
            accuracy: 85,
            correctNotes: 17,
            totalNotes: 20,
            lastUpdated: new Date()
          },
          {
            userId: 'test-user-2',
            userName: 'Test User 2',
            totalScore: 75,
            accuracy: 72,
            correctNotes: 14,
            totalNotes: 19,
            lastUpdated: new Date()
          },
          {
            userId: currentUser.uid,
            userName: currentUser.email || 'Anonymous',
            totalScore: 50,
            accuracy: 60,
            correctNotes: 6,
            totalNotes: 10,
            lastUpdated: new Date()
          }
        ],
        lastUpdated: serverTimestamp()
      });
      
      console.log('Leaderboard created with test data successfully');
      
      // Subscribe to see the result
      const unsubscribe = ScoreboardService.subscribeToLeaderboard((result) => {
        console.log('Leaderboard with test data:', result);
        unsubscribe();
      });
      
    } catch (error) {
      console.error('Error creating leaderboard with test data:', error);
    }
  };

  // Test correct/incorrect note counting
  const testNoteCounting = () => {
    console.log('=== Testing Note Counting ===');
    console.log('Current session stats:', sessionStats);
    console.log('Current chord:', selectedChord);
    console.log('Total notes in chord:', playNotes.length);
    console.log('Completed notes:', Array.from(completedNotes));
    console.log('Current accuracy:', chordAccuracy + '%');
    console.log('Current step index:', currentStepIdx);
    console.log('Is playing:', isPlaying);
    console.log('===========================');
  };

  // Test chord completion without playing notes
  const testChordCompletionWithoutPlaying = async () => {
    if (!currentUser) {
      console.log('No user logged in');
      return;
    }
    
    console.log('=== Testing Chord Completion Without Playing ===');
    console.log('Current chord:', selectedChord);
    console.log('Chord length:', playNotes.length);
    console.log('Current session stats:', sessionStats);
    
    // Simulate chord completion with 0 correct notes
    const chordLength = playNotes.length;
    const correctCount = 0; // No notes played correctly
    const totalPoints = 0; // No points earned
    
    console.log(`Simulating completion: ${correctCount}/${chordLength} notes, ${totalPoints} points`);
    
    try {
      const result = await ScoreboardService.updateUserStatsWithSessionData(
        currentUser.uid,
        currentUser.email || currentUser.displayName || 'Anonymous',
        correctCount,
        chordLength, // Should always be chord length
        totalPoints
      );
      
      console.log('Chord completion test completed successfully');
      
      // Get updated stats to verify
      const statsResult = await ScoreboardService.getUserStats(currentUser.uid);
      console.log('Updated user stats:', statsResult);
      
    } catch (error) {
      console.error('Error testing chord completion:', error);
    }
  };

  // Test stopping playback at different points
  const testStopPlayback = () => {
    console.log('=== Testing Stop Playback ===');
    console.log('Current step index:', currentStepIdx);
    console.log('Current session stats:', sessionStats);
    console.log('Is playing:', isPlaying);
    console.log('Chord length:', playNotes.length);
    
    if (isPlaying) {
      console.log('Stopping playback now...');
      stopPlayback();
    } else {
      console.log('Not currently playing. Start playback first, then test stop.');
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    clearInterval(playTimer.current);
    
    // Update stats when stopping, based on notes that have passed
    if (currentUser && currentStepIdx > 0) {
      const notesPassed = currentStepIdx; // Number of notes that have passed
      const chordLength = playNotes.length;
      const correctCount = sessionStats.correct;
      const totalPoints = currentScore;
      
      console.log(`Stopping playback! Notes passed: ${notesPassed}, Correct: ${correctCount}, Total points: ${totalPoints}`);
      
      // Update stats with the notes that have passed
      ScoreboardService.updateUserStatsWithSessionData(
        currentUser.uid,
        currentUser.email || currentUser.displayName || 'Anonymous',
        correctCount,
        notesPassed, // Use notes passed instead of chord length
        totalPoints
      ).then(() => {
        console.log('Stats updated after stopping playback');
      }).catch(error => {
        console.error('Error updating stats after stopping:', error);
      });
    }
  };

  // UI: Top-level mode selector, then show only relevant dropdown
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0c0e1a 0%, #1a1b2e 50%, #2d1b69 100%)",
      color: "#fff",
      fontFamily: "'Orbitron', 'Montserrat', 'Arial', sans-serif",
      padding: "2rem 0",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Animated background elements */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%)",
        pointerEvents: "none"
      }} />
      
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "0 2rem",
        position: "relative",
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{
          textAlign: "center",
          marginBottom: "3rem",
          padding: "2rem 0"
        }}>
          <h1 style={{
            fontSize: "3.5rem",
            fontWeight: "700",
            margin: "0 0 1rem 0",
            background: "linear-gradient(45deg, #90caf9, #7e57c2, #f48fb1)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 30px rgba(144, 202, 249, 0.3)",
            letterSpacing: "2px"
          }}>
            PLAY ALONG
          </h1>
          <p style={{
            fontSize: "1.2rem",
            color: "#b0bec5",
            margin: "0",
            fontWeight: "300",
            letterSpacing: "1px"
          }}>
            Master guitar chords with real-time guidance
          </p>
          {/* Test element to verify rendering */}
          <div style={{
            background: "rgba(255, 255, 255, 0.1)",
            padding: "1rem",
            borderRadius: "8px",
            marginTop: "1rem",
            fontSize: "0.9rem"
          }}>
            ✅ PlayAlong component is rendering successfully!
          </div>
        </div>

        {/* Debug Info */}
        <div style={{
          background: "rgba(0, 0, 0, 0.7)",
          padding: "0.5rem 1rem",
          borderRadius: "8px",
          fontSize: "0.8rem",
          color: "#fff",
          marginBottom: "1rem",
          textAlign: "center"
        }}>
          <div>User: {currentUser ? currentUser.email : 'Not logged in'} | Auth: {currentUser ? 'Yes' : 'No'}</div>
        </div>

        {/* Score Display */}
        {isPlaying && (
          <div style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(10px)",
            borderRadius: "15px",
            padding: "1.5rem",
            marginBottom: "2rem",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
            textAlign: "center"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#90caf9" }}>
                  {currentScore}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>Score</div>
              </div>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#4caf50" }}>
                  {sessionStats.correct}/{sessionStats.total}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>Correct/Total</div>
              </div>
              <div>
                <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#ffc107" }}>
                  {chordAccuracy}%
                </div>
                <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>Accuracy</div>
              </div>
            </div>
          </div>
        )}

        {/* Control Panel */}
        <div style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(10px)",
          borderRadius: "20px",
          padding: "1.5rem",
          marginBottom: "3rem",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
        }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.5rem"
          }}>
            {/* Top-level mode selector */}
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.5rem' }}>
              <button
                onClick={() => setMainMode("Chords")}
                style={{
                  padding: '0.7em 2em',
                  borderRadius: '10px',
                  border: mainMode === "Chords" ? '2.5px solid #90caf9' : '2px solid #444',
                  background: mainMode === "Chords" ? '#222b44' : '#181a2a',
                  color: mainMode === "Chords" ? '#fff' : '#90caf9',
                  fontWeight: 700,
                  fontSize: '1.1em',
                  cursor: 'pointer',
                  boxShadow: mainMode === "Chords" ? '0 2px 12px #90caf966' : 'none',
                  transition: 'all 0.2s'
                }}
                disabled={isPlaying}
              >
                Chords
              </button>
              <button
                onClick={() => setMainMode("Songs")}
                style={{
                  padding: '0.7em 2em',
                  borderRadius: '10px',
                  border: mainMode === "Songs" ? '2.5px solid #90caf9' : '2px solid #444',
                  background: mainMode === "Songs" ? '#222b44' : '#181a2a',
                  color: mainMode === "Songs" ? '#fff' : '#90caf9',
                  fontWeight: 700,
                  fontSize: '1.1em',
                  cursor: 'pointer',
                  boxShadow: mainMode === "Songs" ? '0 2px 12px #90caf966' : 'none',
                  transition: 'all 0.2s'
                }}
                disabled={isPlaying}
              >
                Songs
              </button>
            </div>

            {/* Chord dropdown (only in Chord mode) */}
            {isChordMode && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                <label style={{ fontSize: '1rem', fontWeight: '600', color: '#90caf9', letterSpacing: '1px' }}>
                  SELECT CHORD
                </label>
                <select
                  value={selectedChord}
                  onChange={e => setSelectedChord(e.target.value)}
                  style={{
                    fontSize: '1.1rem',
                    padding: '0.8rem 1.5rem',
                    borderRadius: '12px',
                    border: '2px solid rgba(144, 202, 249, 0.3)',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontWeight: '500',
                    cursor: 'pointer',
                    minWidth: '180px',
                    textAlign: 'center',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease'
                  }}
                  disabled={isPlaying}
                >
                  {Object.keys(CHORDS).map(name => (
                    <option key={name} value={name} style={{ background: '#1a1b2e', color: '#fff' }}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Song dropdown (only in Song mode) */}
            {isSongMode && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                <label style={{ fontSize: '1rem', fontWeight: '600', color: '#90caf9', letterSpacing: '1px' }}>
                  SELECT SONG
                </label>
                <select
                  value={selectedSong}
                  onChange={e => setSelectedSong(e.target.value)}
                  style={{
                    fontSize: '1.1rem',
                    padding: '0.8rem 1.5rem',
                    borderRadius: '12px',
                    border: '2px solid rgba(144, 202, 249, 0.3)',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontWeight: '500',
                    cursor: 'pointer',
                    minWidth: '180px',
                    textAlign: 'center',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease'
                  }}
                  disabled={isPlaying}
                >
                  {Object.keys(SONGS).map(name => (
                    <option key={name} value={name} style={{ background: '#1a1b2e', color: '#fff' }}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Control Buttons */}
            <div style={{
              display: "flex",
              gap: "1.2rem",
              alignItems: "center"
            }}>
              <button
                onClick={startPlayback}
                disabled={isPlaying}
                style={{
                  fontSize: "1.2rem",
                  padding: "0.8rem 2rem",
                  borderRadius: "50px",
                  border: "none",
                  fontWeight: "600",
                  cursor: isPlaying ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  background: isPlaying 
                    ? "linear-gradient(45deg, #90caf9, #7e57c2)" 
                    : "linear-gradient(45deg, #1976d2, #7e57c2)",
                  color: "#fff",
                  boxShadow: isPlaying 
                    ? "0 0 20px rgba(144, 202, 249, 0.5)" 
                    : "0 4px 15px rgba(25, 118, 210, 0.4)",
                  opacity: isPlaying ? 0.7 : 1,
                  letterSpacing: "1px",
                  minWidth: "120px"
                }}
              >
                ▶️ PLAY
              </button>
              
              <button
                onClick={stopPlayback}
                disabled={!isPlaying}
                style={{
                  fontSize: "1.2rem",
                  padding: "0.8rem 2rem",
                  borderRadius: "50px",
                  border: "none",
                  fontWeight: "600",
                  cursor: !isPlaying ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  background: "linear-gradient(45deg, #e53935, #c62828)",
                  color: "#fff",
                  boxShadow: "0 4px 15px rgba(229, 57, 53, 0.4)",
                  opacity: !isPlaying ? 0.5 : 1,
                  letterSpacing: "1px",
                  minWidth: "120px"
                }}
              >
                ⏹ STOP
              </button>
            </div>
            
            {/* Test Database Button */}
            <div style={{
              marginTop: "1rem"
            }}>
              <button
                onClick={testDatabaseConnection}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(144, 202, 249, 0.3)",
                  background: "rgba(144, 202, 249, 0.1)",
                  color: "#90caf9",
                  cursor: "pointer",
                  transition: "all 0.3s ease"
                }}
              >
                🧪 Test Database
              </button>
              
              <button
                onClick={testLeaderboardUpdate}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(76, 175, 80, 0.3)",
                  background: "rgba(76, 175, 80, 0.1)",
                  color: "#4caf50",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  marginLeft: "0.5rem"
                }}
              >
                🏆 Test Leaderboard
              </button>

              <button
                onClick={createLeaderboardWithTestData}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 152, 0, 0.3)",
                  background: "rgba(255, 152, 0, 0.1)",
                  color: "#ff9800",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  marginLeft: "0.5rem"
                }}
              >
                👥 Create Test Leaderboard
              </button>
              
              <button
                onClick={testNoteCounting}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(156, 39, 176, 0.3)",
                  background: "rgba(156, 39, 176, 0.1)",
                  color: "#9c27b0",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  marginLeft: "0.5rem"
                }}
              >
                📊 Test Note Counting
              </button>

              <button
                onClick={testChordCompletionWithoutPlaying}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 193, 7, 0.3)",
                  background: "rgba(255, 193, 7, 0.1)",
                  color: "#ffc107",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  marginLeft: "0.5rem"
                }}
              >
                🎵 Test Chord Completion (No Play)
              </button>

              <button
                onClick={testStopPlayback}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 152, 0, 0.3)",
                  background: "rgba(255, 152, 0, 0.1)",
                  color: "#ff9800",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  marginLeft: "0.5rem"
                }}
              >
                ⏹ Test Stop Playback
              </button>
            </div>
          </div>
        </div>

        {/* Visual Feedback Overlay */}
        {visualFeedback && (
          <>
            <style>{`
              @keyframes feedbackPop {
                0% {
                  transform: translate(-50%, -50%) scale(0.5);
                  opacity: 0;
                }
                50% {
                  transform: translate(-50%, -50%) scale(1.1);
                  opacity: 1;
                }
                100% {
                  transform: translate(-50%, -50%) scale(1);
                  opacity: 1;
                }
              }
            `}</style>
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              pointerEvents: 'none'
            }}>
              <div style={{
                background: visualFeedback.type === 'correct' 
                  ? `linear-gradient(135deg, ${visualFeedback.color}, ${visualFeedback.color}dd)` 
                  : 'linear-gradient(135deg, #f44336, #d32f2f)',
                color: 'white',
                padding: '20px 30px',
                borderRadius: '15px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                textAlign: 'center',
                minWidth: '200px',
                animation: 'feedbackPop 0.6s ease-out',
                border: visualFeedback.type === 'correct' && visualFeedback.color === '#006400' 
                  ? '2px solid #004d00' 
                  : 'none'
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                }}>
                  {visualFeedback.message}
                </div>
                {visualFeedback.type === 'correct' && visualFeedback.points > 0 && (
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>
                    +{visualFeedback.points} pts
                  </div>
                )}
                {visualFeedback.timing !== 0 && (
                  <div style={{
                    fontSize: '16px',
                    opacity: 0.9
                  }}>
                    {visualFeedback.timing > 0 ? '+' : ''}{visualFeedback.timing}ms
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Countdown Overlay */}
        {showCountdown && countdown > 0 && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              fontSize: '120px',
              color: '#90caf9',
              fontWeight: 'bold',
              textShadow: '0 0 20px rgba(144, 202, 249, 0.8)'
            }}>
              {countdown}
            </div>
          </div>
        )}

        {/* Guitar Display */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "2rem"
        }}>
          <div style={{
            position: "relative",
            width: "640px",
            height: "480px",
            borderRadius: "15px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            border: "2px solid rgba(255, 255, 255, 0.1)"
          }}>
            {(() => {
              try {
                return (
                  <>
                    <PlayAlongOverlay
                      highlightedNotes={isPlaying && playNotes[delayedStepIdx] ? [playNotes[delayedStepIdx]] : []}
                      arpeggioNotes={playNotes}
                      currentStep={isPlaying ? delayedStepIdx : -1}
                      onCorrectNote={handleCorrectNote}
                      onIncorrectNote={handleIncorrectNote}
                    />
                    
                    {/* Debug info for C Major */}
                    {selectedChord === "C Major" && (
                      <div style={{
                        background: "rgba(255, 0, 0, 0.1)",
                        padding: "10px",
                        margin: "10px 0",
                        borderRadius: "5px",
                        fontSize: "12px"
                      }}>
                        <strong>C Major Debug:</strong><br/>
                        Current Step: {JSON.stringify(currentStep)}<br/>
                        Chord Notes: {JSON.stringify(playNotes)}<br/>
                        Is Playing: {isPlaying.toString()}<br/>
                        Current Step Index: {currentStepIdx}<br/>
                        Session Stats: {JSON.stringify(sessionStats)}
                      </div>
                    )}
                  </>
                );
              } catch (error) {
                console.error('Error rendering PlayAlongOverlay:', error);
                return (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    background: "#000",
                    color: "#fff",
                    fontSize: "1.2rem"
                  }}>
                    Camera overlay loading...
                  </div>
                );
              }
            })()}
          </div>
        </div>

        {/* Guitar Hero Interface */}
        {overlayActive && (
          <GuitarHeroInterface 
            playNotes={playNotes}
            currentStepIdx={syncedStepIdx}
            isPlaying={isPlaying}
            playbackStartTimeRef={playbackStartTimeRef}
            playbackTime={playbackTime}
          />
        )}

        {/* Tab Overlay */}
        {overlayActive && (
          <TabOverlay 
            playNotes={playNotes}
            currentStepIdx={currentStepIdx}
            isPlaying={isPlaying}
          />
        )}
      </div>
    </div>
  );
}

export default PlayAlong; 