import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { SearchHistoryService } from '../services/searchHistoryService';
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
    if (!currentUser?.uid) {
      setSearchHistory([]);
      return;
    }
    
    setLoading(true);
    try {
      const result = await SearchHistoryService.getHistory(currentUser.uid);
      
      if (result.success) {
        console.log('Loaded search history:', result.data);
        setSearchHistory(result.data);
      } else {
        console.error('Error loading search history:', result.error);
        setSearchHistory([]);
      }
    } catch (error) {
      console.error('Error loading search history:', error);
      setSearchHistory([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Add new search to history with video title
  const addToHistory = useCallback(async (url, title = '') => {
    if (!currentUser?.uid) {
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
      (item.videoId === videoId || item.url === url)
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

      // Add to history using the service
      const result = await SearchHistoryService.addToHistory(
        currentUser.uid,
        url,
        videoTitle || 'Untitled Video'
      );

      if (result.success) {
        // Update local state with new entry
        const newEntry = {
          id: Date.now().toString(), // Temporary ID for local state
          url: url,
          title: videoTitle || 'Untitled Video',
          timestamp: new Date(),
          videoId: videoId
        };
        console.log('Added new entry to local state:', newEntry);
        setSearchHistory(prev => [newEntry, ...prev]);
        
        // Mark as last saved
        lastSavedUrlRef.current = url;
      } else {
        console.error('Failed to add to history:', result.error);
      }
      
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
    if (!currentUser?.uid) return;

    try {
      // Note: This would need to be implemented in the service
      // For now, just remove from local state
      setSearchHistory(prev => prev.filter(item => item.id !== historyId));
      console.log('Removed item from history:', historyId);
    } catch (error) {
      console.error('Error removing from search history:', error);
    }
  }, [currentUser]);

  // Clear all history for current user
  const clearHistory = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      const result = await SearchHistoryService.clearHistory(currentUser.uid);
      
      if (result.success) {
        setSearchHistory([]);
        lastSavedUrlRef.current = "";
        console.log('Cleared search history');
      } else {
        console.error('Failed to clear history:', result.error);
      }
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }, [currentUser]);

  // Load history when user changes
  useEffect(() => {
    if (currentUser?.uid) {
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