import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { UserService } from "../services/userService";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user) {
        console.log('User authenticated:', user.email);
        
        // Check if user profile exists, create if not
        try {
          const userExists = await UserService.userExists(user.uid);
          if (!userExists) {
            console.log('Creating new user profile for:', user.email);
            await UserService.createUserProfile(user);
          } else {
            console.log('User profile already exists for:', user.email);
          }
        } catch (error) {
          console.error('Error checking/creating user profile:', error);
        }
      }
      
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 