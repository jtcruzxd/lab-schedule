/**
 * auth.js — Firebase Auth guard for index.html
 * Redirects to login.html if not signed in.
 * Adds user info bar and sign-out button.
 */

import { initializeApp }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ── REPLACE with your Firebase project config ──
const firebaseConfig = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // Inject user bar into the toolbar
  const toolbar = document.querySelector('.toolbar-right');
  if (toolbar) {
    const userBar = document.createElement('div');
    userBar.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:12px;color:#718096;border-left:1px solid #e2e8f0;padding-left:12px;margin-left:4px';
    userBar.innerHTML = `
      <span>👤 <strong style="color:#1a3a6b">${user.displayName || user.email}</strong></span>
      <button id="signOutBtn" class="btn btn-sm btn-outline" style="font-size:11px;padding:4px 10px">Sign Out</button>
    `;
    toolbar.appendChild(userBar);
    document.getElementById('signOutBtn').addEventListener('click', () => {
      signOut(auth).then(() => window.location.href = 'login.html');
    });
  }

  // Expose user globally for other scripts
  window.currentUser = user;
});
