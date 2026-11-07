import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SearchHistoryProvider } from "./contexts/SearchHistoryContext";
import SpaceBackground from "./components/SpaceBackground";
import NavBar from "./components/NavBar";
import Home from "./Pages/Home";
import Practice from "./Pages/Practice";
import PlayAlong from "./Pages/PlayAlong";
import CustomTabs from "./Pages/CustomTabs";
import Tuner from "./Pages/Tuner";
import Scoreboard from "./Pages/Scoreboard";
import Settings from "./Pages/Settings";
import SearchHistory from "./Pages/SearchHistory";
import ResetPassword from "./Pages/ResetPassword";
import SplashScreen from "./components/SplashScreen";
import "./css/SpaceTheme.css";
import "./css/App.css";
import "./css/Cosmos.css";
import Login from "./components/Login";
import Signup from "./components/Signup";
import { useAuth } from "./contexts/AuthContext";

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    // Brief intro on first load; any click or key skips it
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2600);
    return () => clearTimeout(timer);
  }, []);

  // Auto-close modal on login
  useEffect(() => {
    if (currentUser) {
      setShowAuthModal(false);
    }
  }, [currentUser]);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  useEffect(() => {
    if (!showAuthModal) return;
    const onKey = (e) => e.key === "Escape" && setShowAuthModal(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAuthModal]);

  const AuthModal = showAuthModal && (
    <div className="auth-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowAuthModal(false)}>
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-label={showSignup ? "Create an account" : "Sign in"}>
        <button className="auth-close" onClick={() => setShowAuthModal(false)} aria-label="Close">
          ×
        </button>
        {showSignup ? (
          <Signup onSwitch={() => setShowSignup(false)} />
        ) : (
          <Login onSwitch={() => setShowSignup(true)} />
        )}
      </div>
    </div>
  );

  if (showSplash) {
    return (
      <SplashScreen 
        onComplete={handleSplashComplete}
        duration={2600}
      />
    );
  }

  return (
    <div className="App">
      <SpaceBackground />
      <NavBar setShowAuthModal={setShowAuthModal} setShowSignup={setShowSignup} />
      {AuthModal}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home setShowAuthModal={setShowAuthModal} setShowSignup={setShowSignup} />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/playalong" element={<PlayAlong />} />
          <Route path="/custom-tabs" element={<CustomTabs />} />
          <Route path="/tuner" element={<Tuner />} />
          <Route path="/scoreboard" element={<Scoreboard />} />
          <Route path="/Settings" element={<Settings />} />
          <Route path="/search-history" element={<SearchHistory />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SearchHistoryProvider>
          <AppContent />
        </SearchHistoryProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;