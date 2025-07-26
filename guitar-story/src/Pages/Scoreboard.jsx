import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ScoreboardService } from '../services/scoreboardService';

function Scoreboard() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Subscribe to real-time leaderboard updates
    const unsubscribe = ScoreboardService.subscribeToLeaderboard((result) => {
      if (result.success) {
        setLeaderboard(result.leaderboard);
        setError(null);
      } else {
        console.warn('Leaderboard subscription failed:', result.error);
        setError(result.error);
        // Set empty leaderboard as fallback
        setLeaderboard([]);
      }
      setLoading(false);
    });

    // Get user's personal stats
    const loadUserStats = async () => {
      try {
        const result = await ScoreboardService.getUserStats(user.uid);
        if (result.success) {
          setUserStats(result.stats);
        } else {
          console.warn('Failed to load user stats:', result.error);
          // Set default stats as fallback
          setUserStats({
            totalScore: 0,
            correctNotes: 0,
            totalNotes: 0,
            accuracy: 0,
            recentScores: []
          });
        }
      } catch (error) {
        console.error('Error loading user stats:', error);
        setUserStats({
          totalScore: 0,
          correctNotes: 0,
          totalNotes: 0,
          accuracy: 0,
          recentScores: []
        });
      }
    };

    loadUserStats();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const formatScore = (score) => {
    return score.toLocaleString();
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  if (!user) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0c0e1a 0%, #1a1b2e 50%, #2d1b69 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Orbitron', 'Montserrat', 'Arial', sans-serif"
      }}>
        <div style={{ textAlign: "center" }}>
          <h2>Please log in to view the scoreboard</h2>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0c0e1a 0%, #1a1b2e 50%, #2d1b69 100%)",
      color: "#fff",
      fontFamily: "'Orbitron', 'Montserrat', 'Arial', sans-serif",
      padding: "2rem 0",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Animated background elements */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%)",
        pointerEvents: "none"
      }} />
      
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "0 2rem",
        position: "relative",
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{
          textAlign: "center",
          marginBottom: "3rem",
          padding: "2rem 0"
        }}>
          <h1 style={{
            fontSize: "3.5rem",
            fontWeight: "700",
            margin: "0 0 1rem 0",
            background: "linear-gradient(45deg, #90caf9, #7e57c2, #f48fb1)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 30px rgba(144, 202, 249, 0.3)",
            letterSpacing: "2px"
          }}>
            LEADERBOARD
          </h1>
          <p style={{
            fontSize: "1.2rem",
            color: "#b0bec5",
            margin: "0",
            fontWeight: "300",
            letterSpacing: "1px"
          }}>
            Compete with guitarists worldwide
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: "rgba(244, 67, 54, 0.1)",
            border: "1px solid rgba(244, 67, 54, 0.3)",
            borderRadius: "12px",
            padding: "1rem",
            marginBottom: "2rem",
            textAlign: "center"
          }}>
            <div style={{ color: "#f44336", fontWeight: "600", marginBottom: "0.5rem" }}>
              ⚠️ Database Connection Issue
            </div>
            <div style={{ color: "#b0bec5", fontSize: "0.9rem" }}>
              The leaderboard is currently unavailable. Your scores will be saved locally.
            </div>
          </div>
        )}

        {/* User Stats Panel */}
        {userStats && (
          <div style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(10px)",
            borderRadius: "20px",
            padding: "2rem",
            marginBottom: "3rem",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
          }}>
            <h3 style={{
              fontSize: "1.5rem",
              fontWeight: "600",
              color: "#90caf9",
              margin: "0 0 1.5rem 0",
              textAlign: "center",
              letterSpacing: "1px"
            }}>
              YOUR STATS
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1.5rem"
            }}>
              <div style={{
                textAlign: "center",
                padding: "1rem",
                background: "rgba(144, 202, 249, 0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(144, 202, 249, 0.3)"
              }}>
                <div style={{ fontSize: "2rem", fontWeight: "700", color: "#90caf9" }}>
                  {formatScore(userStats.totalScore)}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>Total Score</div>
              </div>
              <div style={{
                textAlign: "center",
                padding: "1rem",
                background: "rgba(76, 175, 80, 0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(76, 175, 80, 0.3)"
              }}>
                <div style={{ fontSize: "2rem", fontWeight: "700", color: "#4caf50" }}>
                  {userStats.correctNotes}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>Correct Notes</div>
              </div>
              <div style={{
                textAlign: "center",
                padding: "1rem",
                background: "rgba(255, 193, 7, 0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(255, 193, 7, 0.3)"
              }}>
                <div style={{ fontSize: "2rem", fontWeight: "700", color: "#ffc107" }}>
                  {userStats.accuracy}%
                </div>
                <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>Accuracy</div>
              </div>
              <div style={{
                textAlign: "center",
                padding: "1rem",
                background: "rgba(156, 39, 176, 0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(156, 39, 176, 0.3)"
              }}>
                <div style={{ fontSize: "2rem", fontWeight: "700", color: "#9c27b0" }}>
                  {userStats.totalNotes}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>Total Notes</div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(10px)",
          borderRadius: "20px",
          padding: "2rem",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
        }}>
          <h3 style={{
            fontSize: "1.5rem",
            fontWeight: "600",
            color: "#90caf9",
            margin: "0 0 2rem 0",
            textAlign: "center",
            letterSpacing: "1px"
          }}>
            GLOBAL LEADERBOARD
          </h3>
          
          {loading ? (
            <div style={{
              textAlign: "center",
              padding: "3rem",
              color: "#b0bec5"
            }}>
              Loading leaderboard...
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "3rem",
              color: "#b0bec5"
            }}>
              {error ? 
                "Leaderboard unavailable. Play some chords to see your stats!" : 
                "No scores yet. Be the first to play!"
              }
            </div>
          ) : (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem"
            }}>
              {leaderboard.map((player, index) => (
                <div key={player.userId} style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "1rem 1.5rem",
                  background: player.userId === user?.uid 
                    ? "rgba(144, 202, 249, 0.2)" 
                    : "rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  border: player.userId === user?.uid 
                    ? "2px solid rgba(144, 202, 249, 0.5)" 
                    : "1px solid rgba(255, 255, 255, 0.1)",
                  transition: "all 0.3s ease"
                }}>
                  <div style={{
                    fontSize: "1.5rem",
                    fontWeight: "700",
                    color: index < 3 ? "#ffd700" : "#90caf9",
                    minWidth: "60px",
                    textAlign: "center"
                  }}>
                    {getRankIcon(index + 1)}
                  </div>
                  <div style={{
                    flex: 1,
                    marginLeft: "1rem"
                  }}>
                    <div style={{
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      color: "#fff"
                    }}>
                      {player.userName}
                      {player.userId === user?.uid && (
                        <span style={{
                          marginLeft: "0.5rem",
                          fontSize: "0.8rem",
                          color: "#90caf9",
                          fontWeight: "400"
                        }}>
                          (You)
                        </span>
                      )}
                    </div>
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem"
                    }}>
                      {/* Total Score - Emphasized */}
                      <div style={{
                        fontSize: "1.1rem",
                        fontWeight: "700",
                        color: "#90caf9",
                        textShadow: "0 0 10px rgba(144, 202, 249, 0.3)"
                      }}>
                        {formatScore(player.totalScore)} pts
                      </div>
                      
                      {/* Stats Row */}
                      <div style={{
                        display: "flex",
                        gap: "1rem",
                        fontSize: "0.8rem",
                        color: "#b0bec5"
                      }}>
                        <span>Correct: {player.correctNotes || 0}</span>
                        <span>Total: {player.totalNotes || 0}</span>
                        {player.accuracy && (
                          <span style={{ color: "#4caf50", fontWeight: "500" }}>
                            {player.accuracy}% acc
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: "1.2rem",
                    fontWeight: "700",
                    color: "#90caf9"
                  }}>
                    #{index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Scoreboard; 