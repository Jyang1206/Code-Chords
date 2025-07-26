// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA7E5JHzELZvl4WJ5JaSWXFvj91LKR4U9U",
  authDomain: "code-chords.firebaseapp.com",
  projectId: "code-chords",
  storageBucket: "code-chords.firebasestorage.app",
  messagingSenderId: "218408922180",
  appId: "1:218408922180:web:ef9856cde2e602aa7ae011",
  measurementId: "G-RDJD1K1RYQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const analytics = getAnalytics(app);
export default app;