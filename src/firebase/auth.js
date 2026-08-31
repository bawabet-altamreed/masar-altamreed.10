import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    auth
} from "./firebase.js";


export async function login(email, password) {

    try {

        const result =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        return result.user;

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        throw error;
    }
}


export async function logout() {

    try {

        await signOut(auth);

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        throw error;
    }
}


export function watchAuth(callback) {

    return onAuthStateChanged(
        auth,
        callback
    );
}


export function getCurrentUser() {

    return auth.currentUser;
}
