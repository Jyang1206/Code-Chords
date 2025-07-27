import { db } from "../firebase";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "firebase/firestore";

class CustomTabsService {
  // Add a new custom tab
  static async addCustomTab(userId, tabData) {
    try {
      const tabDataWithMetadata = {
        ...tabData,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPublic: false // Default to private
      };

      const docRef = await addDoc(collection(db, "userTabs"), tabDataWithMetadata);
      
      console.log(`[CUSTOM TABS] Added new tab with ID: ${docRef.id}`);
      return { success: true, tabId: docRef.id };
    } catch (error) {
      console.error('Error adding custom tab:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all custom tabs for a user
  static async getUserTabs(userId) {
    try {
      console.log('[CUSTOM TABS] Getting tabs for user:', userId);
      
      const userTabsRef = collection(db, 'userTabs');
      const q = query(userTabsRef, where('userId', '==', userId));
      
      const querySnapshot = await getDocs(q);
      const tabs = [];
      
      querySnapshot.forEach((doc) => {
        tabs.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort by createdAt on the client side to avoid composite index requirement
      tabs.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime; // Most recent first
      });
      
      console.log('[CUSTOM TABS] Retrieved tabs:', tabs);
      
      return {
        success: true,
        data: tabs
      };
    } catch (error) {
      console.error('[CUSTOM TABS] Error getting user tabs:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get a specific custom tab by ID
  static async getCustomTab(tabId) {
    try {
      const docRef = doc(db, "userTabs", tabId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
      } else {
        return { success: false, error: "Tab not found" };
      }
    } catch (error) {
      console.error('Error getting custom tab:', error);
      return { success: false, error: error.message };
    }
  }

  // Update a custom tab
  static async updateCustomTab(tabId, updatedData) {
    try {
      const docRef = doc(db, "userTabs", tabId);
      await updateDoc(docRef, {
        ...updatedData,
        updatedAt: serverTimestamp()
      });
      
      console.log(`[CUSTOM TABS] Updated tab: ${tabId}`);
      return { success: true };
    } catch (error) {
      console.error('Error updating custom tab:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete a custom tab
  static async deleteCustomTab(tabId) {
    try {
      await deleteDoc(doc(db, "userTabs", tabId));
      
      console.log(`[CUSTOM TABS] Deleted tab: ${tabId}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting custom tab:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all public tabs (for future use)
  static async getPublicTabs() {
    try {
      const q = query(
        collection(db, "userTabs"),
        where("isPublic", "==", true),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const tabs = [];
      
      querySnapshot.forEach((doc) => {
        tabs.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return { success: true, data: tabs };
    } catch (error) {
      console.error('Error getting public tabs:', error);
      return { success: false, error: error.message };
    }
  }
}

export { CustomTabsService }; 