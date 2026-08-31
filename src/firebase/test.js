// Masar Al-Tamreed
// Firebase Connection Test

import { app, auth, db } from "./init.js";

const statusBox = document.getElementById("firebaseStatus");

if (!statusBox) {
    console.error("Firebase status box not found.");
} else {

    statusBox.innerHTML = `
        <div>🟡 جاري اختبار Firebase...</div>
    `;

    try {

        if (!app) {
            throw new Error("Firebase App لم يتم تهيئته.");
        }

        if (!auth) {
            throw new Error("Firebase Authentication لم يتم تهيئته.");
        }

        if (!db) {
            throw new Error("Cloud Firestore لم يتم تهيئته.");
        }

        statusBox.innerHTML = `
            <div class="firebase-success">

                <div>🟢 Firebase App: Connected</div>

                <div>🟢 Authentication: Initialized</div>

                <div>🟢 Firestore: Initialized</div>

                <strong>
                    Firebase is ready ✅
                </strong>

            </div>
        `;

    } catch (error) {

        statusBox.innerHTML = `
            <div class="firebase-error">

                🔴 Firebase Error

                <br><br>

                ${error.message}

            </div>
        `;

    }

}
