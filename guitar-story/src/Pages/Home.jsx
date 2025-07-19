import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import Login from "../components/Login";
import Signup from "../components/Signup";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import YouTubePlayer from "../components/YouTubePlayer";
import { useNavigate } from "react-router-dom";

function Home() {
  const { currentUser } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("https://www.youtube.com/watch?v=TPDjqZaJmjE");
  const navigate = useNavigate();

  if (!currentUser) {
    return showSignup ? (
      <Signup onSwitch={() => setShowSignup(false)} />
    ) : (
      <Login onSwitch={() => setShowSignup(true)} />
    );
  }

  return (
    <div className="home">
      <h1>Welcome to GuitarStory!</h1>
      <p>Logged in as: {currentUser.email}</p>
      <button onClick={() => signOut(auth)}>Logout</button>
      <div style={{ marginTop: 40, marginBottom: 24, textAlign: "center" }}>
        <label style={{ color: "#a3bffa", fontWeight: 500, fontSize: "1.1rem", letterSpacing: 1 }}>
          Paste a YouTube link to practice:
          <input
            type="text"
            value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value.replace(/^@/, ""))}
            placeholder="YouTube URL"
            style={{
              marginLeft: 12,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #232946",
              background: "#181c2b",
              color: "#e0e6f6",
              width: 320,
              maxWidth: "90%",
              fontSize: "1rem",
              boxShadow: "0 0 8px #2d3250"
            }}
          />
        </label>
      </div>
      <YouTubePlayer url={youtubeUrl} />
      <div style={{ marginTop: 48, textAlign: "center" }}>
        <h2>🎸 Play Along</h2>
        <p>Try our real-time tab play-along feature!</p>
        <button
          style={{
            fontSize: "1.2em",
            padding: "0.7em 2.5em",
            borderRadius: 8,
            background: "#ffeb3b",
            color: "#222",
            fontWeight: 700,
            border: "none",
            boxShadow: "0 2px 8px #2222",
            cursor: "pointer"
          }}
          onClick={() => navigate("/playalong")}
        >
          Go to Play Along
        </button>
      </div>
    </div>
  );
}

export default Home; 