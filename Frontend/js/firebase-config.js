// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
// 1. Go to Firebase Console -> Your Project -> Project Settings -> General -> Web App Details
// 2. Copy the config object values here
const firebaseConfig = {
  apiKey: "AIzaSyBJOcuKLP6wNRuToJ0qHnlcis9OyJ3y0jI",
  authDomain: "aastmtroomsystem.firebaseapp.com",
  projectId: "aastmtroomsystem",
  storageBucket: "aastmtroomsystem.firebasestorage.app",
  messagingSenderId: "727935561145",
  appId: "1:727935561145:web:9d2592cc2336872f24da68"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
