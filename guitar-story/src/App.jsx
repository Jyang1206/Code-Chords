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
import SplashScreen from "./components/SplashScreen";
import "./css/SpaceTheme.css";
import "./css/App.css";
import Login from "./components/Login";
import Signup from "./components/Signup";
import { useAuth } from "./contexts/AuthContext";

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    // Show splash screen for 10 seconds on first load
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 10000);
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

  // Modal rendered at the top level
  const AuthModal = (
    showAuthModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{ position: 'relative', minWidth: 350 }}>
          <button
            onClick={() => setShowAuthModal(false)}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 24,
              cursor: 'pointer',
              zIndex: 1001
            }}
            aria-label="Close"
          >
            ×
          </button>
          {showSignup ? (
            <Signup onSwitch={() => setShowSignup(false)} />
          ) : (
            <Login onSwitch={() => setShowSignup(true)} />
          )}
        </div>
      </div>
    )
  );

  if (showSplash) {
    return (
      <SplashScreen 
        onComplete={handleSplashComplete}
        duration={10000}
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