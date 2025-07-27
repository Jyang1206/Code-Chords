import React, { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { useTheme } from "../contexts/ThemeContext";
import "../css/SpaceTheme.css";
import "../css/Login.css";

export default function Login({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { theme } = useTheme();

  const handleLogin = async e => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-loading login-container">
      <div className="space-card login-card">
        <h2 className="glow-text login-title">
          Welcome Back, Explorer
        </h2>
        
        {error && (
          <div className="login-error">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="space-input login-input"
          />
          
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="space-input login-input"
          />
          
          <button 
            type="submit" 
            className="space-button login-submit-button"
          >
            Launch into Orbit
          </button>
        </form>
        
        <div className="section-separator login-separator"></div>
        
        <button 
          onClick={handleGoogleLogin} 
          className="space-button google-button"
        >
          Continue with Google
        </button>
        
        <p className="login-switch-text">
          New to the mission?
        </p>
        
        <button 
          type="button" 
          onClick={onSwitch} 
          className="space-button login-switch-button"
        >
          Join the Mission
        </button>
      </div>
    </div>
  );
} 