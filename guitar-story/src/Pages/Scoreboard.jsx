import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ScoreboardService } from "../services/scoreboardService";
import { MigrationHelper } from "../utils/migrationHelper";
import { createLeaderboardCollection, checkLeaderboardExists, addTestEntry } from "../utils/createLeaderboard";
import { Link } from "react-router-dom";
import "../css/Scoreboard.css";

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

  const PageHead = (
    <header className="page-head">
      <h1>Scoreboard</h1>
      <p>Every note you land in Play along adds to your total. Here is where you stand.</p>
    </header>
  );

  if (!currentUser) {
    return (
      <div className="scoreboard">
        {PageHead}
        <section className="sb-state space-card">
          <h2>Sign in to see the scoreboard</h2>
          <p>Use the sign in button at the top of the page. Your scores and rank will show up here.</p>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="scoreboard">
        {PageHead}
        <section className="sb-state space-card" aria-live="polite" aria-busy="true">
          <h2>Loading the leaderboard</h2>
          <p>This usually takes a second.</p>
        </section>
      </div>
    );
  }

  const isMe = (entry) => entry.email === currentUser.email;
  const fmt = (n) => Number(n || 0).toLocaleString();
  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const medalNames = ["First place", "Second place", "Third place"];

  return (
    <div className="scoreboard">
      {PageHead}

      {leaderboardError && (
        <div className="sb-alert" role="alert">
          <strong>We couldn't load the leaderboard.</strong> Check your connection and refresh the page.
          <span className="sb-alert-detail">{leaderboardError}</span>
        </div>
      )}

      {userStatsError && (
        <div className="sb-alert" role="alert">
          <strong>We couldn't load your stats.</strong> Refresh the page to try again.
          <span className="sb-alert-detail">{userStatsError}</span>
        </div>
      )}

      {userStats && (
        <section className="sb-you space-card" aria-labelledby="sb-you-title">
          <h2 id="sb-you-title">Your numbers</h2>
          <dl className="sb-stats">
            <div className="sb-stat sb-stat--lead">
              <dt>Total score</dt>
              <dd>{fmt(userStats.totalScore)}</dd>
            </div>
            <div className="sb-stat">
              <dt>Accuracy</dt>
              <dd>{userStats.accuracy || 0}<span className="sb-unit">%</span></dd>
            </div>
            <div className="sb-stat">
              <dt>Correct notes</dt>
              <dd>{fmt(userStats.correctNotes)}</dd>
            </div>
            <div className="sb-stat">
              <dt>Notes played</dt>
              <dd>{fmt(userStats.totalNotes)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="sb-board" aria-labelledby="sb-board-title">
        <div className="sb-board-head">
          <h2 id="sb-board-title">Leaderboard</h2>
          {leaderboard.length > 0 && (
            <p>{leaderboard.length} {leaderboard.length === 1 ? "player" : "players"}, ranked by total score</p>
          )}
        </div>

        {leaderboard.length === 0 ? (
          <div className="sb-state space-card">
            <h2>No scores yet</h2>
            <p>Play a song in Play along and your score will be the first one here.</p>
            <Link to="/playalong" className="btn-walnut">Start a play-along</Link>
          </div>
        ) : (
          <>
            <ol className="sb-podium">
              {podium.map((entry, index) => (
                <li
                  key={entry.email}
                  className={`sb-podium-spot sb-podium-spot--${index + 1}${isMe(entry) ? " is-me" : ""}`}
                >
                  <div className="sb-podium-rank">
                    <span className={`sb-medal sb-medal--${index + 1}`} role="img" aria-label={medalNames[index]} />
                    <span className="sb-podium-num" aria-hidden="true">{index + 1}</span>
                  </div>
                  <div className="sb-podium-name">
                    {entry.displayName}
                    {isMe(entry) && <span className="sb-you-tag">You</span>}
                  </div>
                  <div className="sb-podium-score">{fmt(entry.totalScore)}</div>
                  <div className="sb-podium-meta">
                    <span>{entry.accuracy || 0}%</span> accuracy
                  </div>
                </li>
              ))}
            </ol>

            {rest.length > 0 && (
              <div className="sb-table-wrap space-card">
                <table className="sb-table">
                  <thead>
                    <tr>
                      <th scope="col" className="sb-col-rank">Rank</th>
                      <th scope="col">Player</th>
                      <th scope="col" className="sb-num">Accuracy</th>
                      <th scope="col" className="sb-num sb-col-notes">Notes</th>
                      <th scope="col" className="sb-num">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((entry, i) => (
                      <tr key={entry.email} className={isMe(entry) ? "is-me" : undefined}>
                        <td className="sb-col-rank sb-mono">{i + 4}</td>
                        <td className="sb-player">
                          {entry.displayName}
                          {isMe(entry) && <span className="sb-you-tag">You</span>}
                        </td>
                        <td className="sb-num sb-mono">{entry.accuracy || 0}%</td>
                        <td className="sb-num sb-mono sb-col-notes">
                          {fmt(entry.correctNotes)}<span className="sb-of">/{fmt(entry.totalNotes)}</span>
                        </td>
                        <td className="sb-num sb-mono sb-score">{fmt(entry.totalScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default Scoreboard;
