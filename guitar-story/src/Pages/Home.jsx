import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import Login from "../components/Login";
import Signup from "../components/Signup";

function Home() {
  const { currentUser } = useAuth();
  const [showSignup, setShowSignup] = useState(false);

  if (!currentUser) {
    return showSignup ? (
      <Signup onSwitch={() => setShowSignup(false)} />
    ) : (
      <Login onSwitch={() => setShowSignup(true)} />
    );
  }

  return (
    <div className="home">
      <h1>Welcome to GuitarStory!</h1>
    </div>
  );
}

export default Home; 