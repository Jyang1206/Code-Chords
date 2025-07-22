import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

function ResetPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    setStatus("");
    try {
      await sendPasswordResetEmail(auth, email);
      setStatus("Password reset email sent! Check your inbox.");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  return (
    <div className="cosmic-login-bg">
      <form className="cosmic-login-form" onSubmit={handleReset}>
        <h2>Reset Password</h2>
        <input
          className="cosmic-login-input"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <button className="cosmic-login-btn" type="submit" style={{ marginTop: 8 }}>
          Send Reset Email
        </button>
        {status && <div style={{ marginTop: 8 }}>{status}</div>}
      </form>
    </div>
  );
}

export default ResetPassword; 