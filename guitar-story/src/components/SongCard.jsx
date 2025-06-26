import "../css/SongCard.css"
import { useSongContext } from "../contexts/SongContext"

function SongCard({song}) {
    const {isFavorite, addToFavorites, removeFromFavorites} = useSongContext()
    const favorite = isFavorite(song.id)

    function onFavoriteClick(e) {
        e.preventDefault()
        if (favorite) removeFromFavorites(song.id)
        else addToFavorites(song)
    }

    return <div className="song-card">
        <div className="song-thumbnail">
            {/* If the API provides a thumbnail, use it. Otherwise, show a placeholder. */}
            {song.thumbnail ? (
                <img src={song.thumbnail} alt={song.title} />
            ) : (
                <div className="song-placeholder">🎸</div>
            )}
            <div className="song-overlay">
                <button className={`favorite-btn ${favorite ? "active" : ""}`} onClick={onFavoriteClick}>
                    ♥
                </button>
            </div>
        </div>
        <div className="song-info">
            <h3>{song.title}</h3>
            <p>{song.artist || song.artist_name || song.band_name || "Unknown Artist"}</p>
            {song.type && <span className="song-type">{song.type}</span>}
        </div>
    </div>
}

export default SongCard