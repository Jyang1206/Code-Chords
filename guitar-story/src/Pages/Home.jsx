import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import GuitarStage from "../components/GuitarStage";
import "../css/Home.css";
import githubLogo from "../assets/github-mark.png";

const Glyph = ({ name }) => {
  const common = {
    viewBox: "0 0 32 32",
    width: 28,
    height: 28,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  switch (name) {
    case "learn": // the circle of fifths
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" />
          <circle cx="16" cy="16" r="5.5" opacity=".45" />
          <circle cx="16" cy="5" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="25.5" cy="10.5" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="6.5" cy="10.5" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "practice": // a lens over strings
      return (
        <svg {...common}>
          <path d="M3 11h26M3 16h26M3 21h26" opacity=".45" />
          <circle cx="16" cy="16" r="8.5" />
          <circle cx="16" cy="16" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      );
    case "playalong": // falling notes onto a line
      return (
        <svg {...common}>
          <path d="M4 25h24" />
          <circle cx="9" cy="20" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="16" cy="12" r="2.4" />
          <circle cx="23" cy="6" r="2.4" />
          <path d="M9 14v2M16 6v2M23 12v8" opacity=".45" />
        </svg>
      );
    case "tabs": // a staff with fret numbers
      return (
        <svg {...common}>
          <path d="M4 8h24M4 13h24M4 18h24M4 23h24" opacity=".45" />
          <path d="M9 11.5v3M14 16.5v3M20 6.5v3M24 21.5v3" strokeWidth="2.4" />
        </svg>
      );
    case "tuner": // needle on an arc
      return (
        <svg {...common}>
          <path d="M5 22a11 11 0 0 1 22 0" />
          <path d="M16 22 19.5 11" strokeWidth="2" />
          <circle cx="16" cy="22" r="1.8" fill="currentColor" stroke="none" />
          <path d="M16 9v2M8.5 12.5l1.4 1.4M23.5 12.5l-1.4 1.4" opacity=".45" />
        </svg>
      );
    case "scoreboard": // rising bars
      return (
        <svg {...common}>
          <path d="M4 27h24" />
          <rect x="7" y="17" width="4.5" height="10" rx="1" />
          <rect x="14" y="11" width="4.5" height="16" rx="1" />
          <rect x="21" y="5" width="4.5" height="22" rx="1" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
};

const TOOLS = [
  {
    key: "learn",
    title: "Learn",
    path: "/learn",
    open: true,
    body: "Notes, intervals, scales, triads and the circle of fifths, drawn on a fretboard you can click to hear. No account needed.",
  },
  {
    key: "practice",
    title: "Practice",
    path: "/practice",
    body: "Point your webcam at your guitar. Pick a key and one of ten scales and modes, and the notes appear on your own fretboard. Slow down a YouTube lesson alongside it.",
  },
  {
    key: "playalong",
    title: "Play along",
    path: "/playalong",
    body: "Notes scroll toward you as the song plays. The app listens through your mic and scores every note you land.",
  },
  {
    key: "tabs",
    title: "Tabs",
    path: "/custom-tabs",
    body: "Write your own tabs, save them to your account, and load them into Play along.",
  },
  {
    key: "tuner",
    title: "Tuner",
    path: "/tuner",
    body: "Pluck a string and see how far sharp or flat it is, so everything after this sounds right.",
  },
  {
    key: "scoreboard",
    title: "Scoreboard",
    path: "/scoreboard",
    body: "Keep your best scores, watch them climb, and see how you rank against other players.",
  },
];

function Home({ setShowAuthModal, setShowSignup }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const go = (path, open = false) => {
    if (!currentUser && !open) {
      setShowAuthModal(true);
      setShowSignup(false);
    } else {
      navigate(path);
    }
  };

  const firstName = currentUser?.displayName?.split(" ")[0];

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-copy">
          <p className="home-kicker">
            {currentUser ? `Welcome back${firstName ? `, ${firstName}` : ""}.` : "A practice room for guitar, in your browser."}
          </p>
          <h1 id="home-title" className="home-title">
            <span>Guitar</span>
            <span>Story</span>
          </h1>
          <p className="home-lede">
            Your webcam finds the fretboard and lights up the notes of a scale on your own guitar. Then
            the app listens to check you played them.
          </p>
          <div className="home-actions">
            {currentUser ? (
              <>
                <button className="btn-walnut" onClick={() => navigate("/practice")}>Start practising</button>
                <button className="btn-ghost" onClick={() => navigate("/playalong")}>Play a song</button>
              </>
            ) : (
              <>
                <button className="btn-walnut" onClick={() => { setShowAuthModal(true); setShowSignup(true); }}>
                  Create a free account
                </button>
                <button className="btn-ghost" onClick={() => { setShowAuthModal(true); setShowSignup(false); }}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        <GuitarStage />
      </section>

      <section className="home-tools" aria-labelledby="tools-title">
        <header className="home-section-head">
          <h2 id="tools-title">One session, start to finish</h2>
          <p>Tune up, learn the shape, play the song, keep the score. Everything runs in the browser, with nothing to install.</p>
        </header>

        <ul className="tool-list">
          {TOOLS.map((t) => (
            <li key={t.key}>
              <button className="tool-row" onClick={() => go(t.path, t.open)}>
                <span className="tool-glyph"><Glyph name={t.key} /></span>
                <span className="tool-title">{t.title}</span>
                <span className="tool-body">{t.body}</span>
                <svg className="tool-chevron" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                  <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-about" aria-labelledby="about-title">
        <div className="home-about-text">
          <h2 id="about-title">Made by two students who play</h2>
          <p>
            Code Chords started as an NUS Orbital project. We wanted the feedback of a lesson without the
            lesson: a model that finds your fretboard in the camera, a pitch detector that hears what you
            played, and a scoreboard that gives you a reason to come back tomorrow.
          </p>
        </div>
        <div className="home-about-links">
          <a className="person" href="https://www.linkedin.com/in/ng-jie-yang-4928bb242" target="_blank" rel="noopener noreferrer">
            <span className="person-mark" aria-hidden="true">JY</span>
            <span>
              <strong>Ng Jie Yang</strong>
              <small>LinkedIn</small>
            </span>
          </a>
          <a className="person" href="https://www.linkedin.com/in/sean-ow-02722a251" target="_blank" rel="noopener noreferrer">
            <span className="person-mark" aria-hidden="true">SO</span>
            <span>
              <strong>Sean Ow</strong>
              <small>LinkedIn</small>
            </span>
          </a>
          <a className="person person--repo" href="https://github.com/Jyang1206/Code-Chords" target="_blank" rel="noopener noreferrer">
            <span className="person-mark" aria-hidden="true"><img src={githubLogo} alt="" /></span>
            <span>
              <strong>Source code</strong>
              <small>Jyang1206/Code-Chords</small>
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}

export default Home;
