import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { firestore } from '../firebase';
import { useAuth } from './AuthContext';
import { fetchVideoTitle, extractVideoId } from '../utils/youtubeUtils';

const SearchHistoryContext = createContext();

export const useSearchHistory = () => {
  const context = useContext(SearchHistoryContext);
  if (!context) {
    throw new Error('useSearchHistory must be used within a SearchHistoryProvider');
  }
  return context;
};

export const SearchHistoryProvider = ({ children }) => {
  const [searchHistory, setSearchHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();
  const processingUrlsRef = useRef(new Set());
  const lastSavedUrlRef = useRef("");

  // Load search history from Firestore
  const loadSearchHistory = useCallback(async () => {
    if (!currentUser) {
      setSearchHistory([]);
      return;
    }
    
    setLoading(true);
    try {
      const q = query(
        collection(firestore, 'searchHistory'),
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const history = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Loaded search history:', history);
      setSearchHistory(history);
    } catch (error) {
      console.error('Error loading search history:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Add new search to history with video title
  const addToHistory = useCallback(async (url, title = '') => {
    if (!currentUser) {
      console.warn('Cannot add to history: User not authenticated');
      return;
    }
    
    const videoId = extractVideoId(url);
    if (!videoId) {
      console.warn('Cannot add to history: Invalid YouTube URL');
      return;
    }

    console.log('Attempting to add to history:', { url, videoId, title });

    // Check if we're already processing this URL
    if (processingUrlsRef.current.has(url)) {
      console.log('Already processing this URL, skipping:', url);
      return;
    }

    // Check if this URL was just saved
    if (lastSavedUrlRef.current === url) {
      console.log('URL was just saved, skipping:', url);
      return;
    }

    // Check if this video is already in history for this user
    const existingEntry = searchHistory.find(item => 
      (item.videoId === videoId || item.url === url) && item.userId === currentUser.uid
    );

    if (existingEntry) {
      console.log('Video already in history, skipping duplicate:', existingEntry);
      return;
    }

    try {
      // Mark this URL as being processed
      processingUrlsRef.current.add(url);
      console.log('Marked URL as being processed:', url);

      // Fetch video title if not provided
      let videoTitle = title;
      if (!videoTitle) {
        videoTitle = await fetchVideoTitle(videoId);
        console.log('Fetched video title:', videoTitle);
      }

      const searchData = {
        userId: currentUser.uid,
        url: url,
        title: videoTitle || 'Untitled Video',
        timestamp: new Date(),
        videoId: videoId
      };
      
      console.log('Saving to Firestore:', searchData);
      const docRef = await addDoc(collection(firestore, 'searchHistory'), searchData);
      
      // Update local state
      const newEntry = {
        id: docRef.id,
        ...searchData
      };
      console.log('Added new entry to local state:', newEntry);
      setSearchHistory(prev => [newEntry, ...prev]);
      
      // Mark as last saved
      lastSavedUrlRef.current = url;
      
    } catch (error) {
      console.error('Error adding to search history:', error);
    } finally {
      // Remove from processing set
      processingUrlsRef.current.delete(url);
      console.log('Removed URL from processing set:', url);
    }
  }, [currentUser, searchHistory]);

  // Remove item from history
  const removeFromHistory = useCallback(async (historyId) => {
    if (!currentUser) return;

    try {
      await deleteDoc(doc(firestore, 'searchHistory', historyId));
      
      // Update local state
      setSearchHistory(prev => prev.filter(item => item.id !== historyId));
    } catch (error) {
      console.error('Error removing from search history:', error);
    }
  }, [currentUser]);

  // Clear all history for current user
  const clearHistory = useCallback(async () => {
    if (!currentUser) return;

    try {
      const q = query(
        collection(firestore, 'searchHistory'),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      setSearchHistory([]);
      lastSavedUrlRef.current = "";
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }, [currentUser]);

  // Load history when user changes
  useEffect(() => {
    if (currentUser) {
      loadSearchHistory();
    } else {
      setSearchHistory([]);
      lastSavedUrlRef.current = "";
    }
  }, [currentUser, loadSearchHistory]);

  const value = {
    searchHistory,
    loading,
    addToHistory,
    removeFromHistory,
    clearHistory,
    loadSearchHistory
  };

  return (
    <SearchHistoryContext.Provider value={value}>
      {children}
    </SearchHistoryContext.Provider>
  );
}; 