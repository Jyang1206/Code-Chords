import { db } from "../firebase";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";

class ScoreboardService {
  // Add a score entry
  static async addScore(userId, userName, score, chordName, isCorrect) {
    try {
      const scoreRef = doc(collection(db, 'scores'));
      await setDoc(scoreRef, {
        userId,
        userName,
        score,
        chordName,
        isCorrect,
        timestamp: serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error adding score:', error);
      
      // Handle permission errors gracefully
      if (error.message.includes('permission') || error.message.includes('Permission') || error.code === 'permission-denied') {
        console.log('Permission denied for adding score, skipping');
        return { success: true }; // Don't treat permission errors as failures
      }
      
      return { success: false, error: error.message };
    }
  }

  // Get user stats
  static async getUserStats(userId) {
    try {
      const userStatsRef = doc(db, 'user-stats', userId);
      const userStatsDoc = await getDoc(userStatsRef);
      
      if (userStatsDoc.exists()) {
        return { success: true, data: userStatsDoc.data() };
      } else {
        // Return default stats if user doesn't have stats yet
        return { 
          success: true, 
          data: {
            totalScore: 0,
            correctNotes: 0,
            totalNotes: 0,
            accuracy: 0,
            lastUpdated: null
          }
        };
      }
    } catch (error) {
      console.error('Error getting user stats:', error);
      
      // Handle permission errors gracefully
      if (error.message.includes('permission') || error.message.includes('Permission') || error.code === 'permission-denied') {
        console.log('Permission denied for user stats, returning default stats');
        return { 
          success: true, 
          data: {
            totalScore: 0,
            correctNotes: 0,
            totalNotes: 0,
            accuracy: 0,
            lastUpdated: null
          }
        };
      }
      
      return { success: false, error: error.message };
    }
  }

  // Update user stats with session data
  static async updateUserStatsWithSessionData(userId, userName, correctNotes, totalNotes, additionalScore = 0) {
    try {
      const userStatsRef = doc(db, 'user-stats', userId);
      const userStatsDoc = await getDoc(userStatsRef);
      
      let currentStats = {
        totalScore: 0,
        correctNotes: 0,
        totalNotes: 0,
        accuracy: 0,
        lastUpdated: null
      };
      
      if (userStatsDoc.exists()) {
        currentStats = userStatsDoc.data();
      }
      
      // Update stats
      const newCorrectNotes = currentStats.correctNotes + correctNotes;
      const newTotalNotes = currentStats.totalNotes + totalNotes;
      const newTotalScore = currentStats.totalScore + additionalScore;
      const newAccuracy = newTotalNotes > 0 ? Math.round((newCorrectNotes / newTotalNotes) * 100) : 0;
      
      const updatedStats = {
        userId,
        userName,
        totalScore: newTotalScore,
        correctNotes: newCorrectNotes,
        totalNotes: newTotalNotes,
        accuracy: newAccuracy,
        lastUpdated: serverTimestamp()
      };
      
      await setDoc(userStatsRef, updatedStats);
      
      // Update leaderboard
      await this.updateLeaderboard(userId, userName, newTotalScore, newAccuracy, newCorrectNotes, newTotalNotes);
      
      return { success: true, data: updatedStats };
    } catch (error) {
      console.error('Error updating user stats:', error);
      
      // Handle permission errors gracefully
      if (error.message.includes('permission') || error.message.includes('Permission') || error.code === 'permission-denied') {
        console.log('Permission denied for updating user stats, skipping update');
        return { 
          success: true, 
          data: {
            totalScore: 0,
            correctNotes: 0,
            totalNotes: 0,
            accuracy: 0,
            lastUpdated: null
          }
        };
      }
      
      return { success: false, error: error.message };
    }
  }

  // Update leaderboard
  static async updateLeaderboard(userId, userName, totalScore, accuracy, correctNotes, totalNotes) {
    try {
      const leaderboardRef = doc(db, 'scoreboard-db', 'leaderboard');
      const leaderboardDoc = await getDoc(leaderboardRef);
      
      let leaderboard = [];
      if (leaderboardDoc.exists()) {
        leaderboard = leaderboardDoc.data().scores || [];
      }
      
      // Find existing user entry
      const existingUserIndex = leaderboard.findIndex(entry => entry.userId === userId);
      
      const userEntry = {
        userId,
        userName,
        totalScore,
        accuracy,
        correctNotes,
        totalNotes,
        lastUpdated: new Date()
      };
      
      if (existingUserIndex !== -1) {
        // Update existing entry
        leaderboard[existingUserIndex] = userEntry;
      } else {
        // Add new entry
        leaderboard.push(userEntry);
      }
      
      // Sort by total score (descending)
      leaderboard.sort((a, b) => b.totalScore - a.totalScore);
      
      // Keep only top 50 entries
      leaderboard = leaderboard.slice(0, 50);
      
      await setDoc(leaderboardRef, {
        scores: leaderboard,
        lastUpdated: serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error updating leaderboard:', error);
      return { success: false, error: error.message };
    }
  }

  // Subscribe to leaderboard updates
  static subscribeToLeaderboard(callback) {
    try {
      const leaderboardRef = doc(db, 'scoreboard-db', 'leaderboard');
      
      return onSnapshot(leaderboardRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          callback({ success: true, data: data.scores || [] });
        } else {
          callback({ success: true, data: [] });
        }
      }, (error) => {
        console.error('Leaderboard subscription error:', error);
        callback({ success: false, error: error.message });
      });
    } catch (error) {
      console.error('Error setting up leaderboard subscription:', error);
      callback({ success: false, error: error.message });
    }
  }

  // Ensure leaderboard exists
  static async ensureLeaderboardExists() {
    try {
      const leaderboardRef = doc(db, 'scoreboard-db', 'leaderboard');
      const leaderboardDoc = await getDoc(leaderboardRef);
      
      if (!leaderboardDoc.exists()) {
        await setDoc(leaderboardRef, {
          scores: [],
          lastUpdated: serverTimestamp()
        });
        console.log('Leaderboard created successfully');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error ensuring leaderboard exists:', error);
      return { success: false, error: error.message };
    }
  }

  // Get top scores
  static async getTopScores(limit = 10) {
    try {
      const scoresRef = collection(db, 'scores');
      const scoresQuery = query(scoresRef, orderBy('timestamp', 'desc'), limit(limit));
      const scoresSnapshot = await getDocs(scoresQuery);
      
      const scores = [];
      scoresSnapshot.forEach((doc) => {
        scores.push({ id: doc.id, ...doc.data() });
      });
      
      return { success: true, data: scores };
    } catch (error) {
      console.error('Error getting top scores:', error);
      return { success: false, error: error.message };
    }
  }
}

export { ScoreboardService }; 