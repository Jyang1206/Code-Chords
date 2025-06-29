import React, { createContext, useState, useEffect } from "react";
import "./css/App.css";
import Home from "./Pages/Home";
import Practice from "./Pages/Practice";
import LearnSongs from "./Pages/LearnSongs";
import Settings from "./Pages/Settings";
import Tuner from "./Pages/Tuner";
import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import { AuthProvider } from "./contexts/AuthContext";

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
          <Route path="/" element={<Home />} />
          <Route path="/Practice" element={<Practice />} />
          <Route path="/Learn songs" element={<LearnSongs />} />
          <Route path="/Settings" element={<Settings />} />
          <Route path="/tuner" element={<Tuner />} />
        </Routes>
      </main>
    </ThemeContext.Provider>
    </AuthProvider>
  );
}

export default App;