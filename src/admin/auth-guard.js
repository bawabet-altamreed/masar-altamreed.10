// Masar Al-Tamreed
// Admin Authentication Guard

import { auth, db } from "../firebase/init.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


export function protectAdminPage() {

    return new Promise((resolve) => {

        onAuthStateChanged(auth, async (user) => {

            // No Firebase Authentication session
            if (!user) {
                window.location.href = "../login.html";
                return;
            }

            try {

                const userRef = doc(db, "users", user.uid);

                const userSnapshot = await getDoc(userRef);

                if (!userSnapshot.exists()) {

                    await signOut(auth);

                    window.location.href = "../login.html";

                    return;
                }

                const userData = userSnapshot.data();

                // Must be an active admin
                if (
                    userData.role !== "admin" ||
                    userData.isActive !== true
                ) {

                    await signOut(auth);

                    window.location.href = "../login.html";

                    return;
                }

                // Authentication + Authorization successful
                resolve({
                    authUser: user,
                    data: userData
                });

            } catch (error) {

                console.error("Admin authorization error:", error);

                await signOut(auth);

                window.location.href = "../login.html";
            }

        });

    });
}
