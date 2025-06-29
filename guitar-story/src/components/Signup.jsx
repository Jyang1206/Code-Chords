import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

export default function Signup({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async e => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSignup} style={{ maxWidth: 320, margin: "2rem auto", padding: 24, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>Sign Up</h2>
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
      <button type="submit" style={{ width: "100%", marginBottom: 8 }}>Sign Up</button>
      <p>
        Already have an account?{" "}
        <button type="button" onClick={onSwitch}>Login</button>
      </p>
    </form>
  );
} 