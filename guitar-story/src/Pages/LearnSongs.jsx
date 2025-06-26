import React, { useEffect, useState } from "react";
import "../css/LearnSongs.css";
import SongCard from "../components/SongCard";
import { SongProvider } from "../contexts/SongContext";

function LearnSongs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [songs, setSongs] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(null);

  useEffect(() => {
    const loadPopularSongs = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:5001/api/popular");
        const data = await res.json();
        setSongs(Array.isArray(data) ? data : data.results || []);
        setError(null);
      } catch (err) {
        setError("Failed to load popular songs...");
      } finally {
        setLoading(false);
      }
    };
    loadPopularSongs();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5001/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSongs(Array.isArray(data) ? data : data.results || []);
      setError(null);
    } catch (err) {
      setError("No results found");
    } finally {
      setLoading(false);
    }
  };

  const handleViewTab = async (songId) => {
    setSelectedTab("loading");
    try {
      const res = await fetch(`http://localhost:5001/api/tab/${songId}`);
      const data = await res.json();
      setSelectedTab(data.tab || data.content || JSON.stringify(data));
    } catch (err) {
      setSelectedTab("Failed to load tab.");
    }
  };

  return (
    <SongProvider>
      <div className="learnsongs-content">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search for songs or artists..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="search-button">
            Search
          </button>
        </form>
        {error && <div className="error-message">{error}</div>}
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <div className="songs-grid">
            {songs.map((song) => (
              <div key={song.id} className="song-card-wrapper">
                <SongCard song={song} />
                <button className="view-tab-btn" onClick={() => handleViewTab(song.id)}>
                  View Tab
                </button>
              </div>
            ))}
          </div>
        )}
        {selectedTab && (
          <div className="tab-modal">
            <div className="tab-content">
              <pre>{selectedTab}</pre>
              <button onClick={() => setSelectedTab(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </SongProvider>
  );
}

export default LearnSongs; 