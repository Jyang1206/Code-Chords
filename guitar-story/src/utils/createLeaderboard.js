import { db } from "../firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";

// Function to manually create the leaderboard collection
export const createLeaderboardCollection = async () => {
  try {
    console.log('🔄 Creating leaderboard collection...');
    
    // Create the leaderboard document
    const leaderboardRef = doc(db, 'leaderboard', 'global');
    
    const initialData = {
      scores: [],
      lastUpdated: serverTimestamp()
    };
    
    await setDoc(leaderboardRef, initialData);
    
    console.log('✅ Leaderboard collection created successfully!');
    console.log('📁 Collection: leaderboard');
    console.log('📄 Document: global');
    console.log('📊 Initial data:', initialData);
    
    return { 
      success: true, 
      message: 'Leaderboard collection created successfully!' 
    };
    
  } catch (error) {
    console.error('❌ Error creating leaderboard collection:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Function to check if leaderboard exists
export const checkLeaderboardExists = async () => {
  try {
    console.log('🔍 Checking if leaderboard exists...');
    
    const leaderboardRef = doc(db, 'leaderboard', 'global');
    const docSnap = await getDoc(leaderboardRef);
    
    if (docSnap.exists()) {
      console.log('✅ Leaderboard exists!');
      console.log('📊 Current data:', docSnap.data());
      return { exists: true, data: docSnap.data() };
    } else {
      console.log('❌ Leaderboard does not exist');
      return { exists: false };
    }
    
  } catch (error) {
    console.error('❌ Error checking leaderboard:', error);
    return { exists: false, error: error.message };
  }
};

// Function to add a test entry to leaderboard
export const addTestEntry = async (user) => {
  try {
    console.log('🔄 Adding test entry to leaderboard...');
    
    const leaderboardRef = doc(db, 'leaderboard', 'global');
    
    const testEntry = {
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      totalScore: 100,
      accuracy: 85,
      correctNotes: 17,
      totalNotes: 20,
      lastUpdated: new Date().toISOString()
    };
    
    await setDoc(leaderboardRef, {
      scores: [testEntry],
      lastUpdated: serverTimestamp()
    });
    
    console.log('✅ Test entry added successfully!');
    console.log('👤 Test user:', testEntry.displayName);
    
    return { success: true, entry: testEntry };
    
  } catch (error) {
    console.error('❌ Error adding test entry:', error);
    return { success: false, error: error.message };
  }
}; 