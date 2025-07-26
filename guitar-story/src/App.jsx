import React from "react";
import "./css/App.css";
import Home from "./Pages/Home";
import Practice from "./Pages/Practice";
import LearnSongs from "./Pages/LearnSongs";
import Settings from "./Pages/Settings";
import Tuner from "./Pages/Tuner";
import PlayAlong from "./Pages/PlayAlong";
import Scoreboard from "./Pages/Scoreboard";
import SearchHistory from "./Pages/SearchHistory";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ResetPassword from "./Pages/ResetPassword";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import { AuthProvider } from "./contexts/AuthContext";
import { SearchHistoryProvider } from "./contexts/SearchHistoryContext";
import RequireAuth from "./components/RequireAuth";

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
    <AuthProvider>
      <SearchHistoryProvider>
        <ThemeContext.Provider value={{ lightMode, setLightMode }}>
          <NavBar />
          <main className="main-content">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset_password" element={<ResetPassword />} />
              <Route path="/" element={<Home />} />
              <Route path="/Practice" element={<RequireAuth><Practice /></RequireAuth>} />
              <Route path="/Learn songs" element={<RequireAuth><LearnSongs /></RequireAuth>} />
              <Route path="/playalong" element={<RequireAuth><PlayAlong/></RequireAuth>} />
              <Route path="/search-history" element={<RequireAuth><SearchHistory /></RequireAuth>} />
              <Route path="/Settings" element={<RequireAuth><Settings /></RequireAuth>} />
              <Route path="/tuner" element={<RequireAuth><Tuner /></RequireAuth>} />
              {/* Redirect any unknown route to home or login */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </ThemeContext.Provider>
      </SearchHistoryProvider>
    </AuthProvider>
  );
}

export default App;