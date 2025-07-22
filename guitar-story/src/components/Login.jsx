import React, { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import "../css/Login.css";
import { Link } from 'react-router-dom';

export default function Login({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async e => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
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
        /><br/>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="cosmic-login-input"
        /><br/>
        <button type="submit" className="cosmic-login-btn">Login</button>
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