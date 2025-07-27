import { db } from "../firebase";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";

class UserService {
  // Create user profile when they first authenticate
  static async createUserProfile(user) {
    try {
      const userRef = doc(db, 'users', user.uid);
      
      await setDoc(userRef, {
        profile: {
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          uid: user.uid,
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
          authProvider: user.providerData[0]?.providerId || 'email'
        },
        stats: {
          totalScore: 0,
          correctNotes: 0,
          totalNotes: 0,
          accuracy: 0,
          sessionsPlayed: 0,
          lastUpdated: serverTimestamp()
        }
      });

      console.log('User profile created for:', user.email);
      return { success: true };
    } catch (error) {
      console.error('Error creating user profile:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user stats by UID
  static async getUserStats(uid) {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        return { success: true, data: userDoc.data().stats };
      }
      
      // Return default stats if user doesn't exist
      return {
        success: true,
        data: {
          totalScore: 0,
          correctNotes: 0,
          totalNotes: 0,
          accuracy: 0,
          sessionsPlayed: 0,
          lastUpdated: null
        }
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return { success: false, error: error.message };
    }
  }

  // Update user stats by UID
  static async updateUserStats(uid, newStats) {
    try {
      const userRef = doc(db, 'users', uid);
      
      await updateDoc(userRef, {
        'stats': newStats,
        'stats.lastUpdated': serverTimestamp(),
        'profile.lastActive': serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating user stats:', error);
      return { success: false, error: error.message };
    }
  }

  // Add user score by UID
  static async addUserScore(uid, scoreData) {
    try {
      const scoresRef = collection(db, 'userScores', uid, 'scores');
      
      await addDoc(scoresRef, {
        ...scoreData,
        timestamp: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Error adding user score:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user profile by UID
  static async getUserProfile(uid) {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        return { success: true, data: userDoc.data().profile };
      }
      return { success: false, error: 'User not found' };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user scores by UID
  static async getUserScores(uid, limit = 50) {
    try {
      const scoresRef = collection(db, 'userScores', uid, 'scores');
      const scoresQuery = query(scoresRef, orderBy('timestamp', 'desc'), limit(limit));
      const scoresSnapshot = await getDocs(scoresQuery);
      
      const scores = [];
      scoresSnapshot.forEach((doc) => {
        scores.push({ id: doc.id, ...doc.data() });
      });
      
      return { success: true, data: scores };
    } catch (error) {
      console.error('Error getting user scores:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if user exists
  static async userExists(uid) {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      return userDoc.exists();
    } catch (error) {
      console.error('Error checking if user exists:', error);
      return false;
    }
  }
}

export { UserService }; 