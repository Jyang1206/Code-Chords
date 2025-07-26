import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function RequireAuth({ children }) {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return (
      <div style={{
        background: 'rgba(30,30,60,0.95)',
        color: '#ffee91',
        border: '2px solid #6cf',
        borderRadius: 12,
        padding: '2rem',
        margin: '3rem auto',
        maxWidth: 400,
        textAlign: 'center',
        boxShadow: '0 0 24px #6cf8',
        fontFamily: 'Orbitron, Arial, sans-serif',
        fontSize: '1.2rem',
        letterSpacing: 1
      }}>
        <div style={{ fontSize: '2.2rem', marginBottom: 16 }}>🚀</div>
        <div style={{ marginBottom: 12 }}>
          Please <b>create an account</b> and sign up or log in to access this feature.
        </div>
        <Navigate to="/" replace />
      </div>
    );
  }
  return children;
} 