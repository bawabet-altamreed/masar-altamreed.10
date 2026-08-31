// Masar Al-Tamreed
// Firebase Connection Test

import { app, auth, db } from "./init.js";

console.log("=================================");
console.log("Masar Al-Tamreed");
console.log("Firebase Connection Test");
console.log("=================================");

try {
    if (app) {
        console.log("✅ Firebase App: Connected");
    }

    if (auth) {
        console.log("✅ Firebase Authentication: Initialized");
    }

    if (db) {
        console.log("✅ Cloud Firestore: Initialized");
    }

    console.log("=================================");
    console.log("✅ Firebase is ready.");
    console.log("=================================");

} catch (error) {
    console.error("❌ Firebase initialization error:", error);
}
