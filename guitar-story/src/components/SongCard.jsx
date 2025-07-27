import "../css/SpaceTheme.css"
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

    return (
        <div className="song-card space-card" style={{
            transition: 'all 0.3s ease',
            cursor: 'pointer',
            background: 'rgba(26, 26, 46, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '2px solid var(--glow)',
            boxShadow: '0 0 20px var(--glow), inset 0 0 20px rgba(255, 179, 71, 0.1)'
        }}
        onMouseEnter={(e) => e.target.style.transform = 'translateY(-5px)'}
        onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}>
            <div className="song-thumbnail" style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '10px',
                border: '1px solid var(--border)'
            }}>
                {/* If the API provides a thumbnail, use it. Otherwise, show a placeholder. */}
                {song.thumbnail ? (
                    <img src={song.thumbnail} alt={song.title} style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block'
                    }} />
                ) : (
                    <div className="song-placeholder" style={{
                        width: '100%',
                        height: '150px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        color: 'var(--text)'
                    }}>
                        🎸
                    </div>
                )}
                <div className="song-overlay" style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px'
                }}>
                    <button 
                        className={`favorite-btn space-button ${favorite ? "active" : ""}`} 
                        onClick={onFavoriteClick}
                        style={{
                            background: favorite ? 'var(--primary)' : 'transparent',
                            border: '2px solid var(--border)',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            color: favorite ? 'var(--background)' : 'var(--text)',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        ♥
                    </button>
                </div>
            </div>
            <div className="song-info" style={{
                padding: '1rem',
                textAlign: 'center'
            }}>
                <h3 style={{
                    color: 'var(--text)',
                    fontFamily: 'var(--font-primary)',
                    fontSize: '1.2rem',
                    marginBottom: '0.5rem'
                }}>
                    {song.title}
                </h3>
                <p style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-secondary)',
                    fontSize: '0.9rem',
                    marginBottom: '0.5rem'
                }}>
                    {song.artist || song.artist_name || song.band_name || "Unknown Artist"}
                </p>
                {song.type && (
                    <span className="song-type" style={{
                        background: 'var(--primary)',
                        color: 'var(--background)',
                        padding: '0.3rem 0.8rem',
                        borderRadius: '15px',
                        fontSize: '0.8rem',
                        fontFamily: 'var(--font-secondary)',
                        fontWeight: '600'
                    }}>
                        {song.type}
                    </span>
                )}
            </div>
        </div>
    )
}

export default SongCard