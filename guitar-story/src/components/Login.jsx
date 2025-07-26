import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "../css/Login.css";
import { Link } from 'react-router-dom';

export default function Login({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async e => {
    e.preventDefault();
    
    try {
      setError("");
      setLoading(true);
      await login(email, password);
      navigate("/"); // Redirect to home after successful login
    } catch (err) {
      setError("Failed to log in. Please check your credentials.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cosmic-login-bg">
      <form onSubmit={handleLogin} className="cosmic-login-form">
        <h2 className="cosmic-login-title">🚀 Login to GuitarStory</h2>
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
        />        <br/>
        <button 
          type="submit" 
          className="cosmic-login-btn"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        <div className="cosmic-login-switch">
          <Link className="cosmic-login-link" to="/reset_password">
            Forgot Password?
          </Link>
        </div>
        <p className="cosmic-login-switch">
          Don't have an account?{" "}
          <button type="button" className="cosmic-login-link" onClick={onSwitch}>Sign up</button>
        </p>
      </form>
    </div>
  );
} 