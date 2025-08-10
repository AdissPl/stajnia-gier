// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCANGRhbT_a_BTkxWeLl2yfqYIbR3safoU",
  authDomain: "stajnia-gier.firebaseapp.com",
  projectId: "stajnia-gier",
  storageBucket: "stajnia-gier.firebasestorage.app",
  messagingSenderId: "510649052386",
  appId: "1:510649052386:web:8dde595ded00986da182bb",
  measurementId: "G-J8DH8VC9JL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Sign in anonymously
signInAnonymously(auth).catch(err => console.error("Anon sign-in error:", err));

// Show UID when signed in
onAuthStateChanged(auth, user => {
  if (user) {
    console.log("Your UID:", user.uid);
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.top = "10px";
    div.style.left = "10px";
    div.style.padding = "10px";
    div.style.background = "rgba(0,0,0,0.7)";
    div.style.color = "#fff";
    div.style.fontSize = "14px";
    div.style.zIndex = "9999";
    div.innerText = "Your UID: " + user.uid;
    document.body.appendChild(div);
  }
});
