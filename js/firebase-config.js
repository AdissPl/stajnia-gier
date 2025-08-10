// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCANGRhbT_a_BTkxWeLl2yfqYIbR3safoU",
  authDomain: "stajnia-gier.firebaseapp.com",
  projectId: "stajnia-gier",
  storageBucket: "stajnia-gier.firebasestorage.app",
  messagingSenderId: "510649052386",
  appId: "1:510649052386:web:8dde595ded00986da182bb",
  measurementId: "G-J8DH8VC9JL"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Helper
export function onReady(cb){ onAuthStateChanged(auth, u => cb(u||null)); }
