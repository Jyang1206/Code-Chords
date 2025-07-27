import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useTheme } from "../contexts/ThemeContext";
import "../css/SpaceTheme.css";
import "../css/Signup.css";

export default function Signup({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { theme } = useTheme();

  const handleSignup = async e => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);  
    }
  };

  return (
    <div className="space-loading signup-container">
      <div className="space-card signup-card">
        <h2 className="glow-text signup-title">
          Join the Mission
        </h2>
        
        {error && (
          <div className="signup-error">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSignup} className="signup-form">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="space-input signup-input"
          />
          
          <input
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="space-input signup-input"
          />
          
          <button 
            type="submit" 
            className="space-button signup-submit-button"
          >
            Launch Account
          </button>
        </form>
        
        <div className="section-separator signup-separator"></div>
        
        <p className="signup-switch-text">
          Already have an account?
        </p>
        
        <button 
          type="button" 
          onClick={onSwitch} 
          className="space-button signup-switch-button"
        >
          Return to Login
        </button>
      </div>
    </div>
  );
} 