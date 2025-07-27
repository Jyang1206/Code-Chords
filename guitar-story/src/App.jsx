import React from "react";
import "./css/App.css";
import "./css/SpaceTheme.css";
import Home from "./Pages/Home";
import Practice from "./Pages/Practice";
import Settings from "./Pages/Settings";
import Tuner from "./Pages/Tuner";
import PlayAlong from "./Pages/PlayAlong";
import CustomTabs from "./Pages/CustomTabs";
import SearchHistory from "./Pages/SearchHistory";
import Scoreboard from "./Pages/Scoreboard";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ResetPassword from "./Pages/ResetPassword";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar";
import SpaceBackground from "./components/SpaceBackground";
import { AuthProvider } from "./contexts/AuthContext";
import { SearchHistoryProvider } from "./contexts/SearchHistoryContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import RequireAuth from "./components/RequireAuth";

function AppContent() {
  const location = useLocation();
  
  // Debug logging
  console.log('Current location:', location.pathname);
  console.log('AuthProvider should be working');
  
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--background)",
      color: "var(--text)"
    }}>
      <SpaceBackground />
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/reset_password" element={<ResetPassword />} />
          <Route path="/Practice" element={<RequireAuth><Practice /></RequireAuth>} />
          <Route path="/practice" element={<RequireAuth><Practice /></RequireAuth>} />
          <Route path="/playalong" element={<RequireAuth><PlayAlong /></RequireAuth>} />
          <Route path="/search-history" element={<RequireAuth><SearchHistory /></RequireAuth>} />
          <Route path="/Settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/tuner" element={<RequireAuth><Tuner /></RequireAuth>} />
          <Route path="/scoreboard" element={<RequireAuth><Scoreboard /></RequireAuth>} />
          <Route path="/custom-tabs" element={<RequireAuth><CustomTabs /></RequireAuth>} />
          {/* Redirect any unknown route to home or login */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SearchHistoryProvider>
          <AppContent />
        </SearchHistoryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;