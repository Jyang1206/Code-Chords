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

  const PageHead = (
    <header className="page-head">
      <h1>Search history</h1>
      <p>Videos you have opened in Practice. Pick one up where you left off.</p>
    </header>
  );

  if (loading) {
    return (
      <div className="search-history-container">
        {PageHead}
        <div className="loading-spinner" aria-live="polite" aria-busy="true">Loading your history</div>
      </div>
    );
  }

  return (
    <div className="search-history-container">
      {PageHead}

      {searchHistory.length === 0 ? (
        <div className="empty-history space-card">
          <h2>Nothing here yet</h2>
          <p>Paste a YouTube link in Practice and it will be saved here for next time.</p>
          <button
            type="button"
            className="btn-walnut back-to-practice-btn"
            onClick={() => navigate('/Practice')}
          >
            Go to Practice
          </button>
        </div>
      ) : (
        <section className="history-panel space-card" aria-label="Saved videos">
          <div className="history-actions">
            <p className="history-count">
              <span>{searchHistory.length}</span> {searchHistory.length === 1 ? 'video' : 'videos'}
            </p>
            <button
              type="button"
              className="clear-history-btn"
              onClick={clearHistory}
            >
              Clear all history
            </button>
          </div>

          <ul className="history-list">
            {searchHistory.map((item) => (
              <li key={item.id} className="history-item">
                <div className="history-item-content">
                  <div className="video-info">
                    <h3>{item.title || 'Untitled video'}</h3>
                    <p className="video-url">{item.url}</p>
                    <time className="video-date">{formatDate(item.timestamp)}</time>
                  </div>
                  <div className="history-item-actions">
                    <button
                      type="button"
                      className="btn-ghost play-btn"
                      onClick={() => handlePlayVideo(item.url)}
                    >
                      Practice this
                    </button>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeFromHistory(item.id)}
                      aria-label={`Remove ${item.title || 'this video'} from history`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default SearchHistory;
