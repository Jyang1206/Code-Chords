import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ScoreboardService } from "../services/scoreboardService";
import { MigrationHelper } from "../utils/migrationHelper";
import { createLeaderboardCollection, checkLeaderboardExists, addTestEntry } from "../utils/createLeaderboard";

function Scoreboard() {
  const { currentUser } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [userStatsError, setUserStatsError] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (!currentUser) return;

    const loadScoreboardData = async () => {
      try {
        setLoading(true);
        setLeaderboardError(null);
        setUserStatsError(null);
        
        console.log('Loading scoreboard data for user:', currentUser.uid);
        
        // Ensure leaderboard exists first
        await ScoreboardService.ensureLeaderboardExists();
        
        // Load leaderboard
        const unsubscribe = ScoreboardService.subscribeToLeaderboard((result) => {
          console.log('Leaderboard subscription result:', result);
          if (result.success) {
            setLeaderboard(result.data || []);
            setLeaderboardError(null);
            console.log('Leaderboard updated:', result.data);
          } else {
            console.error('Failed to load leaderboard:', result.error);
            setLeaderboardError(result.error);
          }
        });

        // Load user stats
        const statsResult = await ScoreboardService.getUserStats(currentUser.uid);
        console.log('User stats result:', statsResult);
        if (statsResult.success) {
          setUserStats(statsResult.data);
          setUserStatsError(null);
        } else {
          console.error('Failed to load user stats:', statsResult.error);
          setUserStatsError(statsResult.error);
        }

        return unsubscribe;
      } catch (error) {
        console.error('Error loading scoreboard data:', error);
        setLeaderboardError(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadScoreboardData();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0c0e1a 0%, #1a1b2e 50%, #2d1b69 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{ textAlign: "center" }}>
          <h1>Please log in to view the scoreboard</h1>
          <p>You need to be authenticated to see your scores and the leaderboard.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0c0e1a 0%, #1a1b2e 50%, #2d1b69 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{ textAlign: "center" }}>
          <h2>Loading Scoreboard...</h2>
          <p>Please wait while we fetch your data.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0c0e1a 0%, #1a1b2e 50%, #2d1b69 100%)",
      color: "#fff",
      padding: "2rem"
    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "2rem"
      }}>
        <h1 style={{
          fontSize: "3rem",
          fontWeight: "700",
          color: "#90caf9",
          textAlign: "center",
          marginBottom: "1rem"
        }}>
          Scoreboard
        </h1>

        {/* Error Messages */}
        {leaderboardError && (
          <div style={{
            background: "rgba(244, 67, 54, 0.1)",
            border: "1px solid rgba(244, 67, 54, 0.3)",
            borderRadius: "12px",
            padding: "1rem",
            color: "#f44336"
          }}>
            <strong>Leaderboard Error:</strong> {leaderboardError}
          </div>
        )}

        {userStatsError && (
          <div style={{
            background: "rgba(244, 67, 54, 0.1)",
            border: "1px solid rgba(244, 67, 54, 0.3)",
            borderRadius: "12px",
            padding: "1rem",
            color: "#f44336"
          }}>
            <strong>User Stats Error:</strong> {userStatsError}
          </div>
        )}

        {/* User Stats Section */}
        {userStats && (
          <div style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(10px)",
            borderRadius: "20px",
            padding: "2rem",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
          }}>
            <h2 style={{
              fontSize: "2rem",
              fontWeight: "600",
              color: "#90caf9",
              marginBottom: "1.5rem",
              textAlign: "center"
            }}>
              Your Stats
            </h2>
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
                  {userStats.totalScore || 0}
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
                  {userStats.accuracy || 0}%
                </div>
                <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>Accuracy</div>
              </div>
              <div style={{
                textAlign: "center",
                padding: "1rem",
                background: "rgba(255, 193, 7, 0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(255, 193, 7, 0.3)"
              }}>
                <div style={{ fontSize: "2rem", fontWeight: "700", color: "#ffc107" }}>
                  {userStats.correctNotes || 0}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>Correct Notes</div>
              </div>
              <div style={{
                textAlign: "center",
                padding: "1rem",
                background: "rgba(156, 39, 176, 0.1)",
                borderRadius: "12px",
                border: "1px solid rgba(156, 39, 176, 0.3)"
              }}>
                <div style={{ fontSize: "2rem", fontWeight: "700", color: "#9c27b0" }}>
                  {userStats.totalNotes || 0}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#b0bec5" }}>Total Notes</div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Section */}
        <div style={{
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(10px)",
          borderRadius: "20px",
          padding: "2rem",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
        }}>
          <h2 style={{
            fontSize: "2rem",
            fontWeight: "600",
            color: "#90caf9",
            marginBottom: "1.5rem",
            textAlign: "center"
          }}>
            Leaderboard
          </h2>
          
          {leaderboard.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "3rem",
              color: "#b0bec5"
            }}>
              <p>No scores yet. Start practicing to see the leaderboard!</p>
              <p style={{ fontSize: "0.9rem", marginTop: "1rem" }}>
                Try playing some chords in the Practice or Play Along sections to generate scores.
              </p>
            </div>
          ) : (
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem"
            }}>
              {leaderboard.map((entry, index) => (
                <div key={entry.email} style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "1rem",
                  background: entry.email === currentUser.email 
                    ? "rgba(144, 202, 249, 0.2)" 
                    : "rgba(255, 255, 255, 0.05)",
                  borderRadius: "12px",
                  border: entry.email === currentUser.email 
                    ? "2px solid rgba(144, 202, 249, 0.5)" 
                    : "1px solid rgba(255, 255, 255, 0.1)"
                }}>
                  <div style={{
                    fontSize: "1.5rem",
                    fontWeight: "700",
                    color: index === 0 ? "#ffd700" : index === 1 ? "#c0c0c0" : index === 2 ? "#cd7f32" : "#90caf9",
                    minWidth: "60px"
                  }}>
                    #{index + 1}
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
                      {entry.displayName}
                    </div>
                    <div style={{
                      fontSize: "0.9rem",
                      color: "#b0bec5"
                    }}>
                      Score: {entry.totalScore} | Accuracy: {entry.accuracy}% | Notes: {entry.correctNotes}/{entry.totalNotes}
                    </div>
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