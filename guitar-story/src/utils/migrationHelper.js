import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { UserService } from "../services/userService";
import { ScoreboardService } from "../services/scoreboardService";

class MigrationHelper {
  // Test the new UID-based structure
  static async testNewStructure(user) {
    try {
      console.log('Testing new UID-based structure for user:', user.email);
      
      // Test user profile creation
      const createResult = await UserService.createUserProfile(user);
      console.log('User profile creation result:', createResult);
      
      // Test user stats retrieval
      const statsResult = await UserService.getUserStats(user.uid);
      console.log('User stats retrieval result:', statsResult);
      
      // Test user existence check
      const existsResult = await UserService.userExists(user.uid);
      console.log('User exists check result:', existsResult);
      
      return {
        success: true,
        createResult,
        statsResult,
        existsResult
      };
    } catch (error) {
      console.error('Error testing new structure:', error);
      return { success: false, error: error.message };
    }
  }

  // Test leaderboard updates
  static async testLeaderboardUpdate(user) {
    try {
      console.log('Testing leaderboard update for user:', user.email);
      
      // Ensure user profile exists
      await UserService.createUserProfile(user);
      
      // Test updating user stats and leaderboard
      const result = await ScoreboardService.updateUserStatsWithSessionData(
        user.uid,
        user.displayName || user.email.split('@')[0],
        5, // correct notes
        10, // total notes
        50 // additional score
      );
      
      console.log('Leaderboard update test result:', result);
      
      // Check if leaderboard was updated
      const leaderboardResult = await ScoreboardService.getTopScores();
      console.log('Current leaderboard:', leaderboardResult);
      
      return {
        success: true,
        updateResult: result,
        leaderboardResult
      };
    } catch (error) {
      console.error('Error testing leaderboard update:', error);
      return { success: false, error: error.message };
    }
  }

  // Clean up old collections (use with caution!)
  static async cleanupOldCollections() {
    try {
      console.log('Cleaning up old collections...');
      
      // This is a destructive operation - use with extreme caution!
      // In production, you should backup data first
      
      const collectionsToClean = ['user-stats', 'searchHistory', 'scoreboard-db']; // Old collection names
      
      for (const collectionName of collectionsToClean) {
        try {
          const collectionRef = collection(db, collectionName);
          const snapshot = await getDocs(collectionRef);
          
          const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
          await Promise.all(deletePromises);
          
          console.log(`Cleaned up collection: ${collectionName}`);
        } catch (error) {
          console.error(`Error cleaning up ${collectionName}:`, error);
        }
      }
      
      console.log('Cleanup completed');
      return { success: true };
      
    } catch (error) {
      console.error('Cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Create test data for leaderboard
  static async createTestLeaderboard() {
    try {
      console.log('Creating test leaderboard...');
      
      const testData = {
        scores: [
          {
            email: 'test1@example.com',
            displayName: 'Test User 1',
            totalScore: 150,
            accuracy: 85,
            correctNotes: 17,
            totalNotes: 20,
            lastUpdated: new Date().toISOString() // Use ISO string instead of serverTimestamp
          },
          {
            email: 'test2@example.com',
            displayName: 'Test User 2',
            totalScore: 120,
            accuracy: 80,
            correctNotes: 16,
            totalNotes: 20,
            lastUpdated: new Date().toISOString() // Use ISO string instead of serverTimestamp
          }
        ],
        lastUpdated: serverTimestamp() // Only use serverTimestamp at document level
      };
      
      const leaderboardRef = doc(db, 'leaderboard', 'global');
      await setDoc(leaderboardRef, testData);
      
      console.log('Test leaderboard created successfully');
      return { success: true };
      
    } catch (error) {
      console.error('Error creating test leaderboard:', error);
      return { success: false, error: error.message };
    }
  }

  // Test all services
  static async testAllServices(user) {
    try {
      console.log('Testing all services for user:', user.email);
      
      const results = {
        userService: await this.testNewStructure(user),
        leaderboard: await this.createTestLeaderboard(),
        leaderboardUpdate: await this.testLeaderboardUpdate(user)
      };
      
      console.log('All services test results:', results);
      return results;
      
    } catch (error) {
      console.error('Error testing all services:', error);
      return { success: false, error: error.message };
    }
  }
}

export { MigrationHelper }; 