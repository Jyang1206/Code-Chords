import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  updateDoc,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { firestore as db } from '../firebase';
import { auth } from '../firebase';

// Collection names
const SCORES_COLLECTION = 'scoreboard-db';
const LEADERBOARD_COLLECTION = 'scoreboard-db';

// Scoreboard Service
export class ScoreboardService {
  
  // Check if user is authenticated
  static isAuthenticated() {
    const isAuth = auth.currentUser !== null;
    console.log('Authentication check:', { isAuth, currentUser: auth.currentUser });
    return isAuth;
  }

  // Get current user ID
  static getCurrentUserId() {
    return auth.currentUser?.uid;
  }

  // Get current user name
  static getCurrentUserName() {
    return auth.currentUser?.email || 'Anonymous';
  }

  // Add or update user score
  static async addScore(userId, userName, score, chordName, isCorrect) {
    try {
      // Check authentication
      console.log('Checking authentication...', { userId, userName, isAuthenticated: this.isAuthenticated() });
      if (!this.isAuthenticated()) {
        console.warn('User not authenticated, skipping score update');
        return { success: false, error: 'User not authenticated' };
      }

      const scoreData = {
        userId,
        userName,
        score,
        chordName,
        isCorrect,
        timestamp: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };

      // Create a unique document ID for this score entry
      const scoreDocId = `${userId}_${Date.now()}`;
      const scoreRef = doc(db, SCORES_COLLECTION, scoreDocId);
      
      // Store the individual score entry
      await setDoc(scoreRef, {
        userId,
        userName,
        score,
        chordName,
        isCorrect,
        timestamp: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });

      // Update user's total stats
      await this.updateUserStats(userId, userName, score, isCorrect);
      
      return { success: true };
    } catch (error) {
      console.error('Error adding score:', error);
      return { success: false, error: error.message };
    }
  }

  // Update user's total statistics
  static async updateUserStats(userId, userName, score, isCorrect) {
    try {
      console.log('Updating user stats:', { userId, userName, score, isCorrect });
      
      const userStatsRef = doc(db, SCORES_COLLECTION, `stats_${userId}`);
      const userStatsDoc = await getDoc(userStatsRef);
      
      if (userStatsDoc.exists()) {
        // Update existing stats
        const currentData = userStatsDoc.data();
        const newTotalScore = currentData.totalScore + (isCorrect ? score : 0);
        const newCorrectNotes = currentData.correctNotes + (isCorrect ? 1 : 0);
        const newTotalNotes = currentData.totalNotes + 1;
        
        console.log('Updating existing stats:', {
          old: { totalScore: currentData.totalScore, correctNotes: currentData.correctNotes, totalNotes: currentData.totalNotes },
          new: { totalScore: newTotalScore, correctNotes: newCorrectNotes, totalNotes: newTotalNotes }
        });
        
        await updateDoc(userStatsRef, {
          totalScore: newTotalScore,
          correctNotes: newCorrectNotes,
          totalNotes: newTotalNotes,
          lastUpdated: serverTimestamp()
        });
      } else {
        // Create new stats document
        const newStats = {
          userId,
          userName,
          totalScore: isCorrect ? score : 0,
          correctNotes: isCorrect ? 1 : 0,
          totalNotes: 1,
          lastUpdated: serverTimestamp()
        };
        console.log('Creating new stats:', newStats);
        
        await setDoc(userStatsRef, newStats);
      }

      // Update leaderboard
      await this.updateLeaderboard(userId, userName, isCorrect ? score : 0);
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  }

  // Update user stats with correct count from session
  static async updateUserStatsWithSessionData(userId, userName, correctCount, totalCount, score) {
    try {
      console.log('Updating user stats with session data:', { userId, userName, correctCount, totalCount, score });
      
      const userStatsRef = doc(db, SCORES_COLLECTION, `stats_${userId}`);
      const userStatsDoc = await getDoc(userStatsRef);
      
      if (userStatsDoc.exists()) {
        // Update existing stats with session data
        const currentData = userStatsDoc.data();
        const newTotalScore = currentData.totalScore + score;
        const newCorrectNotes = currentData.correctNotes + correctCount;
        const newTotalNotes = currentData.totalNotes + totalCount; // Add the chord length
        
        console.log('Updating existing stats with session data:', {
          old: { totalScore: currentData.totalScore, correctNotes: currentData.correctNotes, totalNotes: currentData.totalNotes },
          new: { totalScore: newTotalScore, correctNotes: newCorrectNotes, totalNotes: newTotalNotes },
          sessionData: { correctCount, totalCount, score }
        });
        
        await updateDoc(userStatsRef, {
          totalScore: newTotalScore,
          correctNotes: newCorrectNotes,
          totalNotes: newTotalNotes,
          lastUpdated: serverTimestamp()
        });
      } else {
        // Create new stats document with session data
        const newStats = {
          userId,
          userName,
          totalScore: score,
          correctNotes: correctCount,
          totalNotes: totalCount,
          lastUpdated: serverTimestamp()
        };
        console.log('Creating new stats with session data:', newStats);
        
        await setDoc(userStatsRef, newStats);
      }

      // Update leaderboard with accuracy and stats
      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      await this.updateLeaderboard(userId, userName, score, accuracy, correctCount, totalCount);
    } catch (error) {
      console.error('Error updating user stats with session data:', error);
    }
  }

  // Update leaderboard
  static async updateLeaderboard(userId, userName, score, accuracy = 0, correctNotes = 0, totalNotes = 0) {
    try {
      console.log('Updating leaderboard:', { userId, userName, score, accuracy, correctNotes, totalNotes });
      
      const leaderboardRef = doc(db, LEADERBOARD_COLLECTION, 'leaderboard');
      const leaderboardDoc = await getDoc(leaderboardRef);
      
      if (leaderboardDoc.exists()) {
        const currentLeaderboard = leaderboardDoc.data().scores || [];
        console.log('Current leaderboard:', currentLeaderboard);
        
        const userIndex = currentLeaderboard.findIndex(entry => entry.userId === userId);
        console.log('User index:', userIndex);
        
        if (userIndex !== -1) {
          // Update existing user
          const oldScore = currentLeaderboard[userIndex].totalScore;
          currentLeaderboard[userIndex].totalScore += score;
          currentLeaderboard[userIndex].accuracy = accuracy;
          currentLeaderboard[userIndex].correctNotes = (currentLeaderboard[userIndex].correctNotes || 0) + correctNotes;
          currentLeaderboard[userIndex].totalNotes = (currentLeaderboard[userIndex].totalNotes || 0) + totalNotes;
          currentLeaderboard[userIndex].lastUpdated = new Date();
          console.log(`Updated user ${userName}: ${oldScore} + ${score} = ${currentLeaderboard[userIndex].totalScore}, accuracy: ${accuracy}%`);
        } else {
          // Add new user
          currentLeaderboard.push({
            userId,
            userName,
            totalScore: score,
            accuracy: accuracy,
            correctNotes: correctNotes,
            totalNotes: totalNotes,
            lastUpdated: new Date()
          });
          console.log(`Added new user ${userName} with score ${score} and accuracy ${accuracy}%`);
        }
        
        // Sort by total score (descending)
        currentLeaderboard.sort((a, b) => b.totalScore - a.totalScore);
        console.log('Sorted leaderboard:', currentLeaderboard);
        
        await updateDoc(leaderboardRef, {
          scores: currentLeaderboard,
          lastUpdated: serverTimestamp()
        });
        console.log('Leaderboard updated successfully');
      } else {
        // Create new leaderboard
        console.log('Creating new leaderboard with user:', { userId, userName, score, accuracy, correctNotes, totalNotes });
        await setDoc(leaderboardRef, {
          scores: [{
            userId,
            userName,
            totalScore: score,
            accuracy: accuracy,
            correctNotes: correctNotes,
            totalNotes: totalNotes,
            lastUpdated: new Date()
          }],
          lastUpdated: serverTimestamp()
        });
        console.log('New leaderboard created successfully');
      }
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  }

  // Force create leaderboard if it doesn't exist
  static async ensureLeaderboardExists() {
    try {
      const leaderboardRef = doc(db, LEADERBOARD_COLLECTION, 'leaderboard');
      const leaderboardDoc = await getDoc(leaderboardRef);
      
      if (!leaderboardDoc.exists()) {
        console.log('Leaderboard does not exist, creating empty leaderboard...');
        await setDoc(leaderboardRef, {
          scores: [],
          lastUpdated: serverTimestamp()
        });
        console.log('Empty leaderboard created successfully');
      } else {
        console.log('Leaderboard already exists');
      }
    } catch (error) {
      console.error('Error ensuring leaderboard exists:', error);
    }
  }

  // Get real-time leaderboard with error handling
  static subscribeToLeaderboard(callback) {
    try {
      // Check authentication
      if (!this.isAuthenticated()) {
        console.warn('User not authenticated, returning empty leaderboard');
        callback({
          success: false,
          error: 'User not authenticated',
          leaderboard: []
        });
        return () => {}; // Return empty unsubscribe function
      }

      const leaderboardRef = doc(db, LEADERBOARD_COLLECTION, 'leaderboard');
      
      const unsubscribe = onSnapshot(leaderboardRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          callback({
            success: true,
            leaderboard: data.scores || [],
            lastUpdated: data.lastUpdated
          });
        } else {
          callback({
            success: true,
            leaderboard: [],
            lastUpdated: null
          });
        }
      }, (error) => {
        console.error('Error subscribing to leaderboard:', error);
        callback({
          success: false,
          error: error.message,
          leaderboard: []
        });
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up leaderboard subscription:', error);
      callback({
        success: false,
        error: error.message,
        leaderboard: []
      });
      return () => {}; // Return empty unsubscribe function
    }
  }

  // Get user's personal stats
  static async getUserStats(userId) {
    try {
      // Check authentication
      if (!this.isAuthenticated()) {
        console.warn('User not authenticated, returning empty stats');
        return {
          success: false,
          error: 'User not authenticated',
          stats: {
            totalScore: 0,
            correctNotes: 0,
            totalNotes: 0,
            accuracy: 0,
            recentScores: [] // Not storing recent scores in new structure
          }
        };
      }

      const userStatsRef = doc(db, SCORES_COLLECTION, `stats_${userId}`);
      const userStatsDoc = await getDoc(userStatsRef);
      
      if (userStatsDoc.exists()) {
        const data = userStatsDoc.data();
        return {
          success: true,
          stats: {
            totalScore: data.totalScore || 0,
            correctNotes: data.correctNotes || 0,
            totalNotes: data.totalNotes || 0,
            accuracy: data.totalNotes > 0 ? (data.correctNotes / data.totalNotes * 100).toFixed(1) : 0,
            recentScores: [] // Not storing recent scores in new structure
          }
        };
      } else {
        return {
          success: true,
          stats: {
            totalScore: 0,
            correctNotes: 0,
            totalNotes: 0,
            accuracy: 0,
            recentScores: []
          }
        };
      }
    } catch (error) {
      console.error('Error getting user stats:', error);
      return { 
        success: false, 
        error: error.message,
        stats: {
          totalScore: 0,
          correctNotes: 0,
          totalNotes: 0,
          accuracy: 0,
          recentScores: []
        }
      };
    }
  }

  // Get top players (for performance)
  static async getTopPlayers(limit = 10) {
    try {
      // Check authentication
      if (!this.isAuthenticated()) {
        console.warn('User not authenticated, returning empty top players');
        return {
          success: false,
          error: 'User not authenticated',
          topPlayers: []
        };
      }

      const leaderboardRef = doc(db, LEADERBOARD_COLLECTION, 'leaderboard');
      const leaderboardDoc = await getDoc(leaderboardRef);
      
      if (leaderboardDoc.exists()) {
        const data = leaderboardDoc.data();
        return {
          success: true,
          topPlayers: (data.scores || []).slice(0, limit)
        };
      } else {
        return {
          success: true,
          topPlayers: []
        };
      }
    } catch (error) {
      console.error('Error getting top players:', error);
      return { 
        success: false, 
        error: error.message,
        topPlayers: []
      };
    }
  }
} 