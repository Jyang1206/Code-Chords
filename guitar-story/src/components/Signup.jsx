import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "../css/Login.css";

export default function Signup({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async e => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return setError("Passwords do not match");
    }
    
    try {
      setError("");
      setLoading(true);
      await signup(email, password);
      navigate("/"); // Redirect to home after successful signup
    } catch (err) {
      setError("Failed to create an account. Please try again.");
      console.error("Signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cosmic-login-bg">
      <form onSubmit={handleSignup} className="cosmic-login-form">
        <h2 className="cosmic-login-title">🚀 Sign Up for GuitarStory</h2>
        {error && <div className="cosmic-login-error">{error}</div>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="cosmic-login-input"
          disabled={loading}
        /><br/>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="cosmic-login-input"
          disabled={loading}
        /><br/>
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          className="cosmic-login-input"
          disabled={loading}
        /><br/>
        <button 
          type="submit" 
          className="cosmic-login-btn"
          disabled={loading}
        >
          {loading ? "Creating Account..." : "Sign Up"}
        </button>
        <p className="cosmic-login-switch">
          Already have an account?{" "}
          <button type="button" className="cosmic-login-link" onClick={onSwitch}>Login</button>
        </p>
      </form>
    </div>
  );
} 