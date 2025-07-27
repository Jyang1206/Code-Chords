import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// Simple utility to create the leaderboard collection
export const setupLeaderboard = async () => {
  try {
    console.log('Setting up leaderboard collection...');
    
    const leaderboardRef = doc(db, 'leaderboard', 'global');
    
    await setDoc(leaderboardRef, {
      scores: [],
      lastUpdated: serverTimestamp()
    });
    
    console.log('✅ Leaderboard collection created successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Error creating leaderboard:', error);
    return { success: false, error: error.message };
  }
};

// Test the leaderboard update
export const testLeaderboardUpdate = async (user) => {
  try {
    console.log('Testing leaderboard update...');
    
    // First ensure leaderboard exists
    await setupLeaderboard();
    
    // Add a test entry
    const testEntry = {
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      totalScore: 100,
      accuracy: 85,
      correctNotes: 17,
      totalNotes: 20,
      lastUpdated: new Date().toISOString()
    };
    
    const leaderboardRef = doc(db, 'leaderboard', 'global');
    await setDoc(leaderboardRef, {
      scores: [testEntry],
      lastUpdated: serverTimestamp()
    });
    
    console.log('✅ Test leaderboard entry added successfully!');
    return { success: true };
  } catch (error) {
    console.error('❌ Error testing leaderboard:', error);
    return { success: false, error: error.message };
  }
}; 