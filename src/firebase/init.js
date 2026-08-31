// Firebase initialization
// Masar Al-Tamreed

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import { getAuth } from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import { getFirestore } from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { firebaseConfig } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication
export const auth = getAuth(app);

// Cloud Firestore
export const db = getFirestore(app);

// Firebase App
export { app };
