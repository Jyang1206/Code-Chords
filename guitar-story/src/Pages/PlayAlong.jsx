import React, { useState, useRef, useEffect } from "react";
import PlayAlongOverlay from "../components/PlayAlongOverlay";
import { useAuth } from "../contexts/AuthContext";
import { ScoreboardService } from "../services/scoreboardService";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const CHORDS_ORIGINAL = {
  "C Major": [
    { stringIdx: 1, fretNum: 3, note: "C", isRoot: true }, // 5th string (A)
    { stringIdx: 2, fretNum: 2, note: "E" },               // 4th string (D)
    { stringIdx: 3, fretNum: 0, note: "G" },               // 3rd string (G)
    { stringIdx: 4, fretNum: 1, note: "C" },               // 2nd string (B)
    { stringIdx: 5, fretNum: 0, note: "E" },               // 1st string (high E)
  ],
  "G Major": [
    { stringIdx: 0, fretNum: 3, note: "G", isRoot: true }, // 6th string (low E)
    { stringIdx: 1, fretNum: 2, note: "B" },               // 5th string (A)
    { stringIdx: 2, fretNum: 0, note: "D" },               // 4th string (D)
    { stringIdx: 3, fretNum: 0, note: "G" },               // 3rd string (G)
    { stringIdx: 4, fretNum: 0, note: "B" },               // 2nd string (B)
    { stringIdx: 5, fretNum: 3, note: "G" },               // 1st string (high E)
  ],
  "E Major": [
    { stringIdx: 0, fretNum: 0, note: "E", isRoot: true }, // 6th string (low E)
    { stringIdx: 1, fretNum: 2, note: "A" },               // 5th string (A)
    { stringIdx: 2, fretNum: 2, note: "B" },               // 4th string (D)
    { stringIdx: 3, fretNum: 1, note: "E" },               // 3rd string (G)
    { stringIdx: 4, fretNum: 0, note: "B" },               // 2nd string (B)
    { stringIdx: 5, fretNum: 0, note: "E" },               // 1st string (high E)
  ],
  "A Major": [
    { stringIdx: 0, fretNum: 0, note: "E", mute: true },   // 6th string (low E, not played)
    { stringIdx: 1, fretNum: 0, note: "A", isRoot: true }, // 5th string (A)
    { stringIdx: 2, fretNum: 2, note: "D" },               // 4th string (D)
    { stringIdx: 3, fretNum: 2, note: "F#" },              // 3rd string (G)
    { stringIdx: 4, fretNum: 2, note: "A" },               // 2nd string (B)
    { stringIdx: 5, fretNum: 0, note: "E" },               // 1st string (high E)
  ],
  "D Major": [
    { stringIdx: 0, fretNum: 0, note: "E", mute: true },   // 6th string (low E, not played)
    { stringIdx: 1, fretNum: 0, note: "A", mute: true },   // 5th string (A, not played)
    { stringIdx: 2, fretNum: 0, note: "D", isRoot: true }, // 4th string (D)
    { stringIdx: 3, fretNum: 2, note: "A" },               // 3rd string (G)
    { stringIdx: 4, fretNum: 3, note: "F#" },              // 2nd string (B)
    { stringIdx: 5, fretNum: 2, note: "D" },               // 1st string (high E)
  ],
};

const CHORDS = Object.fromEntries(
  Object.entries(CHORDS_ORIGINAL).map(([chord, notes]) => [
    chord,
    notes
      .filter(n => !n.mute)
      .map(n => ({ ...n, stringIdx: 6 - n.stringIdx }))
  ])
);

function PlayAlong() {
  console.log('PlayAlong component is rendering!');
  const { currentUser } = useAuth();
  const [selectedChord, setSelectedChord] = useState("C Major");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [chordAccuracy, setChordAccuracy] = useState(0);
  const [completedNotes, setCompletedNotes] = useState(new Set()); // Track which notes have been completed
  const playTimer = useRef(null);
  const latestSessionStatsRef = useRef({ correct: 0, total: 0 }); // Track latest session stats

  const chordNotes = CHORDS[selectedChord];
  const currentStep = chordNotes[currentStepIdx] || null;

  // Reset completed notes when chord changes
  useEffect(() => {
    setCompletedNotes(new Set());
    const newSessionStats = { correct: 0, total: chordNotes.length };
    setSessionStats(newSessionStats);
    latestSessionStatsRef.current = newSessionStats; // Update ref
    setChordAccuracy(0);
    setCurrentScore(0);
  }, [selectedChord]);

  // Calculate accuracy based on current chord's total notes
  const calculateAccuracy = (correct, totalNotes) => {
    if (totalNotes === 0) return 0;
    return Math.round((correct / totalNotes) * 100);
  };

  // Handle correct note played
  const handleCorrectNote = async () => {
    if (!currentUser) return;
    
    // Create a unique identifier for this note (stringIdx + fretNum combination)
    const noteId = `${currentStep.stringIdx}-${currentStep.fretNum}`;
    
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
    
    const scorePoints = 10; // Base points for correct note
    const newScore = currentScore + scorePoints;
    setCurrentScore(newScore);
    
    // Update session stats for this chord
    const newCorrect = sessionStats.correct + 1;
    const totalNotesInChord = chordNotes.length;
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

    // Save individual score entry (for tracking purposes)
    try {
      console.log(`[DB DEBUG] Adding individual score:`, {
        uid: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email.split('@')[0] || 'Anonymous',
        score: scorePoints,
        chord: selectedChord,
        isCorrect: true
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
    const totalNotesInChord = chordNotes.length;
    const currentCorrect = sessionStats.correct;
    const newAccuracy = calculateAccuracy(currentCorrect, totalNotesInChord);
    
    console.log(`Incorrect note ${noteId}, accuracy: ${newAccuracy}% (${currentCorrect}/${totalNotesInChord})`);
    setChordAccuracy(newAccuracy);
    
    // Also send incorrect note to database (with 0 points)
    if (currentUser) {
      ScoreboardService.addScore(
        currentUser.uid,
        currentUser.displayName || currentUser.email.split('@')[0] || 'Anonymous',
        0, // No points for incorrect note
        selectedChord,
        false // Mark as incorrect
      ).catch(error => {
        console.error('Error saving incorrect note:', error);
      });
    }
  };

  const startPlayback = () => {
    setIsPlaying(true);
    setCurrentStepIdx(0);
    setCurrentScore(0);
    const newSessionStats = { correct: 0, total: chordNotes.length };
    setSessionStats(newSessionStats);
    latestSessionStatsRef.current = newSessionStats; // Update ref
    setChordAccuracy(0);
    setCompletedNotes(new Set()); // Reset completed notes
    playTimer.current = setInterval(() => {
      setCurrentStepIdx(idx => {
        if (idx < chordNotes.length - 1) {
          return idx + 1;
        } else {
          clearInterval(playTimer.current);
          setIsPlaying(false);
          // Update final scoreboard when chord is completed
          // Add a small delay to ensure state updates are complete
          setTimeout(() => {
            updateFinalScoreboard();
          }, 100);
          return idx;
        }
      });
    }, 1200);
  };

  // Update final scoreboard when chord is completed
  const updateFinalScoreboard = async () => {
    if (!currentUser) return;
    
    // Use the latest session stats from the ref to ensure we have the most current data
    const latestStats = latestSessionStatsRef.current;
    const finalAccuracy = calculateAccuracy(latestStats.correct, latestStats.total);
    const bonusPoints = Math.round((finalAccuracy / 100) * 50); // Bonus points based on accuracy
    const totalPoints = currentScore + bonusPoints;
    const chordLength = chordNotes.length; // Total notes in the chord
    
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
    console.log('Total notes in chord:', chordNotes.length);
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
    console.log('Chord length:', chordNotes.length);
    console.log('Current session stats:', sessionStats);
    
    // Simulate chord completion with 0 correct notes
    const chordLength = chordNotes.length;
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
    console.log('Chord length:', chordNotes.length);
    
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
      const chordLength = chordNotes.length;
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
            {/* Chord Selector */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.8rem"
            }}>
              <label style={{
                fontSize: "1rem",
                fontWeight: "600",
                color: "#90caf9",
                letterSpacing: "1px"
              }}>
                SELECT CHORD
              </label>
              <select
                value={selectedChord}
                onChange={e => setSelectedChord(e.target.value)}
                style={{
                  fontSize: "1.1rem",
                  padding: "0.8rem 1.5rem",
                  borderRadius: "12px",
                  border: "2px solid rgba(144, 202, 249, 0.3)",
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  fontWeight: "500",
                  cursor: "pointer",
                  minWidth: "180px",
                  textAlign: "center",
                  backdropFilter: "blur(10px)",
                  transition: "all 0.3s ease"
                }}
                disabled={isPlaying}
              >
                {Object.keys(CHORDS).map(name => (
                  <option key={name} value={name} style={{ background: "#1a1b2e", color: "#fff" }}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

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
                      highlightedNotes={isPlaying && currentStep ? [currentStep] : []}
                      arpeggioNotes={chordNotes}
                      currentStep={isPlaying ? currentStepIdx : -1}
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
                        Chord Notes: {JSON.stringify(chordNotes)}<br/>
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

        {/* Status Display */}
        <div style={{
          textAlign: "center",
          padding: "1.5rem",
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "15px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(10px)"
        }}>
          <div style={{
            fontSize: "1.4rem",
            fontWeight: "600",
            color: isPlaying ? "#90caf9" : "#b0bec5",
            textShadow: isPlaying ? "0 0 10px rgba(144, 202, 249, 0.5)" : "none",
            transition: "all 0.3s ease"
          }}>
            {isPlaying && currentStep
              ? `Playing: String ${6 - currentStep.stringIdx} • Fret ${currentStep.fretNum}`
              : `Selected: ${selectedChord}`}
          </div>
          {isPlaying && (
            <div style={{
              fontSize: "1rem",
              color: "#90caf9",
              marginTop: "0.5rem",
              fontWeight: "400"
            }}>
              Step {currentStepIdx + 1} of {chordNotes.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlayAlong; 