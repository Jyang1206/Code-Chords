import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import "../css/Auth.css";
import "../css/ResetPassword.css";

function ResetPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    setStatus("");
    try {
      await sendPasswordResetEmail(auth, email);
      setStatus("Reset link sent. Check your inbox, and your spam folder if it is not there in a minute.");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  const isError = status.startsWith("Error: ");

  return (
    <div className="reset-page">
      <div className="auth-card">
        <div className="auth-strings" aria-hidden="true">
          <span /><span /><span /><span /><span /><span />
        </div>
        <h2 className="auth-title">Reset your password</h2>
        <p className="auth-sub">Enter the email you signed up with and we will send you a link to choose a new password.</p>
        <form className="auth-form" onSubmit={handleReset}>
          <label className="auth-field">
            <span>Email</span>
            <input
              className="space-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </label>
          <button className="btn-walnut auth-submit" type="submit">
            Send reset link
          </button>
          {status && (
            isError ? (
              <div className="auth-error" role="alert">
                We couldn't send the email. Check the address and try again. ({status.slice(7)})
              </div>
            ) : (
              <div className="reset-ok" role="status">{status}</div>
            )
          )}
        </form>
      </div>
    </div>
  );
}

export default ResetPassword;
