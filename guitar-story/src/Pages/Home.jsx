import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import Login from "../components/Login";
import Signup from "../components/Signup";

function Home() {
  const { user, logout } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  if (!user) {
    return showSignup ? (
      <Signup onSwitch={() => setShowSignup(false)} />
    ) : (
      <Login onSwitch={() => setShowSignup(true)} />
    );
  }

  return (
    <div className="home">
      <h1>Welcome to GuitarStory!</h1>
      <p>Logged in as: {user.email}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default Home; 