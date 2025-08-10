// js/auth-ui.js
import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

function mountUI(){
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:10px;top:10px;background:rgba(0,0,0,.7);color:#fff;padding:10px;z-index:9999;font:14px/1.3 sans-serif;border-radius:8px";
  box.innerHTML = `
    <div id="auth-logged" style="display:none">
      <div>UID: <span id="uid"></span></div>
      <button id="logout">Wyloguj</button>
    </div>
    <div id="auth-form">
      <input id="email" placeholder="email" style="width:220px;margin:2px 0;padding:6px"/>
      <input id="pass"  placeholder="hasło" type="password" style="width:220px;margin:2px 0;padding:6px"/>
      <div style="display:flex;gap:6px;margin-top:4px">
        <button id="login">Zaloguj</button>
        <button id="signup">Rejestruj</button>
      </div>
      <div id="auth-msg" style="margin-top:6px;color:#ffd"></div>
    </div>
  `;
  document.body.appendChild(box);

  const $ = s => box.querySelector(s);
  $("#login").onclick = async () => {
    try {
      await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#pass").value);
      $("#auth-msg").textContent = "";
    } catch(e){ $("#auth-msg").textContent = e.message; }
  };
  $("#signup").onclick = async () => {
    try {
      await createUserWithEmailAndPassword(auth, $("#email").value.trim(), $("#pass").value);
      $("#auth-msg").textContent = "Konto utworzone. Zalogowano.";
    } catch(e){ $("#auth-msg").textContent = e.message; }
  };
  $("#logout").onclick = () => signOut(auth);

  onAuthStateChanged(auth, u => {
    $("#auth-form").style.display = u ? "none" : "";
    $("#auth-logged").style.display = u ? "" : "none";
    if (u) $("#uid").textContent = u.uid;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountUI);
} else {
  mountUI();
}
