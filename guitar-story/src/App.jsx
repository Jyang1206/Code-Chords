import React, { createContext, useState, useEffect } from "react";
import "./css/App.css";
import Home from "./Pages/Home";
import Practice from "./Pages/Practice";
import LearnSongs from "./Pages/LearnSongs";
import Settings from "./Pages/Settings";
import Tuner from "./Pages/Tuner";
import PlayAlong from "./Pages/PlayAlong";
import SearchHistory from "./Pages/SearchHistory";
import Scoreboard from "./Pages/Scoreboard";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ResetPassword from "./Pages/ResetPassword";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar";
import { AuthProvider } from "./contexts/AuthContext";
import { SearchHistoryProvider } from "./contexts/SearchHistoryContext";
import RequireAuth from "./components/RequireAuth";

export const ThemeContext = createContext();

// Debug component to test routing
function DebugRoute() {
  return (
    <div style={{ padding: "2rem", color: "#fff" }}>
      <h1>Debug Route Working!</h1>
      <p>If you can see this, routing is working.</p>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  
  // Debug logging
  console.log('Current location:', location.pathname);
  console.log('AuthProvider should be working');
  
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0c0e1a 0%, #1a1b2e 50%, #2d1b69 100%)",
      color: "#fff"
    }}>
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/debug" element={<DebugRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset_password" element={<ResetPassword />} />
          <Route path="/Practice" element={<RequireAuth><Practice /></RequireAuth>} />
          <Route path="/practice" element={<RequireAuth><Practice /></RequireAuth>} />
          <Route path="/Learn songs" element={<RequireAuth><LearnSongs /></RequireAuth>} />
          <Route path="/learnsongs" element={<RequireAuth><LearnSongs /></RequireAuth>} />
          <Route path="/playalong" element={<RequireAuth><PlayAlong /></RequireAuth>} />
          <Route path="/search-history" element={<RequireAuth><SearchHistory /></RequireAuth>} />
          <Route path="/Settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/tuner" element={<RequireAuth><Tuner /></RequireAuth>} />
          <Route path="/scoreboard" element={<RequireAuth><Scoreboard /></RequireAuth>} />
          {/* Redirect any unknown route to home or login */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [lightMode, setLightMode] = useState(false);

  useEffect(() => {
    if (lightMode) {
      document.body.classList.add("light-mode");
    } else {
      document.body.classList.remove("light-mode");
    }
    return () => {
      document.body.classList.remove("light-mode");
    };
  }, [lightMode]);

  return (
    <AuthProvider>
      <SearchHistoryProvider>
        <ThemeContext.Provider value={{ lightMode, setLightMode }}>
          <AppContent />
        </ThemeContext.Provider>
      </SearchHistoryProvider>
    </AuthProvider>
  );
}

export default App;