import React from 'react';
import { useSearchHistory } from '../contexts/SearchHistoryContext';
import { useNavigate } from 'react-router-dom';
import '../css/SearchHistory.css';

const SearchHistory = () => {
  const { searchHistory, loading, removeFromHistory, clearHistory } = useSearchHistory();
  const navigate = useNavigate();

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const handlePlayVideo = (url) => {
    // Navigate back to practice page with the selected URL
    navigate('/Practice', { state: { youtubeUrl: url } });
  };

  // Debug: Log search history to console
  console.log('Search History Data:', searchHistory);
  console.log('Search History Length:', searchHistory.length);

  if (loading) {
    return (
      <div className="search-history-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="search-history-container">
      <div className="search-history-header">
        <h1>📺 YouTube Search History</h1>
        <p>Your recently played YouTube videos</p>
        {/* Debug info */}
        <p style={{ fontSize: '0.8rem', color: '#6c7b7f', marginTop: '8px' }}>
          Total entries: {searchHistory.length}
        </p>
      </div>

      {searchHistory.length === 0 ? (
        <div className="empty-history">
          <p>No search history yet. Start practicing with YouTube videos!</p>
          <button 
            className="back-to-practice-btn"
            onClick={() => navigate('/Practice')}
          >
            Go to Practice
          </button>
        </div>
      ) : (
        <>
          <div className="history-actions">
            <button 
              className="clear-history-btn"
              onClick={clearHistory}
            >
              Clear All History
            </button>
          </div>

          <div className="history-list">
            {searchHistory.map((item, index) => (
              <div key={item.id} className="history-item">
                <div className="history-item-content">
                  <div className="video-info">
                    <h3>{item.title || 'Untitled Video'}</h3>
                    <p className="video-url">{item.url}</p>
                    <p className="video-date">{formatDate(item.timestamp)}</p>
               
                  </div>
                  <div className="history-item-actions">
                    <button 
                      className="play-btn"
                      onClick={() => handlePlayVideo(item.url)}
                    >
                      ▶ Play
                    </button>
                    <button 
                      className="remove-btn"
                      onClick={() => removeFromHistory(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default SearchHistory; 