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
import RequireAuth from "./components/RequireAuth";
import SplashScreen from "./components/SplashScreen";
import "./css/SpaceTheme.css";
import "./css/App.css";

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Show splash screen for 5 seconds on first load
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return (
      <SplashScreen 
        onComplete={handleSplashComplete}
        duration={5000}
      />
    );
  }

  return (
    <div className="App">
      <SpaceBackground />
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/practice" element={<RequireAuth><Practice /></RequireAuth>} />
          <Route path="/playalong" element={<RequireAuth><PlayAlong /></RequireAuth>} />
          <Route path="/custom-tabs" element={<RequireAuth><CustomTabs /></RequireAuth>} />
          <Route path="/tuner" element={<RequireAuth><Tuner /></RequireAuth>} />
          <Route path="/scoreboard" element={<RequireAuth><Scoreboard /></RequireAuth>} />
          <Route path="/Settings" element={<RequireAuth><Settings /></RequireAuth>} />
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