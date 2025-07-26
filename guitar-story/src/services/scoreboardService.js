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
import { UserService } from "./userService";

class ScoreboardService {
  // Update leaderboard with email-based user data
  static async updateLeaderboard(email, userData) {
    try {
      const leaderboardRef = doc(db, 'leaderboard', 'global');
      const leaderboardDoc = await getDoc(leaderboardRef);
      
      let scores = [];
      if (leaderboardDoc.exists()) {
        scores = leaderboardDoc.data().scores || [];
      }
      
      // Update or add user entry
      const existingIndex = scores.findIndex(entry => entry.email === email);
      const userEntry = {
        email: email,
        displayName: userData.displayName || email.split('@')[0],
        totalScore: userData.totalScore,
        accuracy: userData.accuracy,
        correctNotes: userData.correctNotes,
        totalNotes: userData.totalNotes,
        lastUpdated: new Date().toISOString() // Use ISO string instead of serverTimestamp
      };
      
      if (existingIndex !== -1) {
        scores[existingIndex] = userEntry;
      } else {
        scores.push(userEntry);
      }
      
      // Sort and limit
      scores.sort((a, b) => b.totalScore - a.totalScore);
      scores = scores.slice(0, 50);
      
      await setDoc(leaderboardRef, {
        scores,
        lastUpdated: serverTimestamp() // Only use serverTimestamp at document level
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
      const leaderboardRef = doc(db, 'leaderboard', 'global');
      
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
      const leaderboardRef = doc(db, 'leaderboard', 'global');
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

  // Get user stats by UID
  static async getUserStats(uid) {
    return await UserService.getUserStats(uid);
  }

  // Update user stats with session data by UID
  static async updateUserStatsWithSessionData(uid, displayName, correctNotes, totalNotes, additionalScore = 0) {
    try {
      // Get current stats
      const statsResult = await UserService.getUserStats(uid);
      if (!statsResult.success) {
        return statsResult;
      }

      let currentStats = statsResult.data;

      // Update stats
      const newCorrectNotes = currentStats.correctNotes + correctNotes;
      const newTotalNotes = currentStats.totalNotes + totalNotes;
      const newTotalScore = currentStats.totalScore + additionalScore;
      const newAccuracy = newTotalNotes > 0 ? Math.round((newCorrectNotes / newTotalNotes) * 100) : 0;

      const updatedStats = {
        totalScore: newTotalScore,
        correctNotes: newCorrectNotes,
        totalNotes: newTotalNotes,
        accuracy: newAccuracy,
        sessionsPlayed: currentStats.sessionsPlayed + 1,
        lastUpdated: serverTimestamp()
      };

      // Update user stats
      await UserService.updateUserStats(uid, updatedStats);

      // Get user profile to get email for leaderboard
      const profileResult = await UserService.getUserProfile(uid);
      if (profileResult.success) {
        const userEmail = profileResult.data.email;
        
        // Update leaderboard with user's new stats
        await this.updateLeaderboard(userEmail, {
          displayName: displayName || profileResult.data.displayName,
          totalScore: newTotalScore,
          accuracy: newAccuracy,
          correctNotes: newCorrectNotes,
          totalNotes: newTotalNotes
        });
        
        console.log('Updated leaderboard for user:', userEmail);
      } else {
        console.warn('Could not get user profile for leaderboard update');
      }

      return { success: true, data: updatedStats };
    } catch (error) {
      console.error('Error updating user stats with session data:', error);
      return { success: false, error: error.message };
    }
  }

  // Add a score entry by UID
  static async addScore(uid, displayName, score, chordName, isCorrect) {
    try {
      // Get user profile to get email
      const profileResult = await UserService.getUserProfile(uid);
      const userEmail = profileResult.success ? profileResult.data.email : 'unknown@user.com';
      
      const scoreData = {
        uid,
        email: userEmail,
        displayName,
        score,
        chordName,
        isCorrect,
        timestamp: serverTimestamp()
      };

      // Add to user's scores subcollection
      await UserService.addUserScore(uid, scoreData);

      return { success: true };
    } catch (error) {
      console.error('Error adding score:', error);
      return { success: false, error: error.message };
    }
  }

  // Get top scores from all users
  static async getTopScores(limit = 10) {
    try {
      const leaderboardRef = doc(db, 'leaderboard', 'global');
      const leaderboardDoc = await getDoc(leaderboardRef);
      
      if (leaderboardDoc.exists()) {
        const scores = leaderboardDoc.data().scores || [];
        return { success: true, data: scores.slice(0, limit) };
      }
      
      return { success: true, data: [] };
    } catch (error) {
      console.error('Error getting top scores:', error);
      return { success: false, error: error.message };
    }
  }
}

export { ScoreboardService }; 