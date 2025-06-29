import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

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
    <form onSubmit={handleLogin} style={{ maxWidth: 320, margin: "2rem auto", padding: 24, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>Login</h2>
      {error && <div style={{ color: "red" }}>{error}</div>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        style={{ width: "100%", marginBottom: 8 }}
      /><br/>
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        style={{ width: "100%", marginBottom: 8 }}
      /><br/>
      <button type="submit" style={{ width: "100%", marginBottom: 8 }}>Login</button>
      <p>
        Don't have an account?{" "}
        <button type="button" onClick={onSwitch}>Sign up</button>
      </p>
    </form>
  );
} 