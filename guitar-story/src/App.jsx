import React, { createContext, useState, useEffect } from "react";
import "./css/App.css";
import Home from "./Pages/Home";
import Practice from "./Pages/Practice";
import LearnSongs from "./Pages/LearnSongs";
import Settings from "./Pages/Settings";
import Tuner from "./Pages/Tuner";
import PlayAlong from "./Pages/PlayAlong";
import Login from "./components/Login";
import Signup from "./components/Signup";
import ResetPassword from "./Pages/ResetPassword";
import { Routes, Route, Navigate } from "react-router-dom";
import NavBar from "./components/NavBar";
import { AuthProvider } from "./contexts/AuthContext";
import RequireAuth from "./components/RequireAuth";

export const ThemeContext = createContext();

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
            <Route path="/Settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="/tuner" element={<RequireAuth><Tuner /></RequireAuth>} />
            {/* Redirect any unknown route to home or login */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </ThemeContext.Provider>
    </AuthProvider>
  );
}

export default App;