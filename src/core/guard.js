import {
    watchAuth
} from "../firebase/auth.js";

import {
    doc,
    getDoc
} from
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    db
} from "../firebase/firebase.js";


export function requireAuth() {

    watchAuth(
        async (user) => {

            if (!user) {

                window.location.href =
                    "/login.html";

                return;
            }

            await loadUserRole(user.uid);
        }
    );
}


async function loadUserRole(uid) {

    try {

        const userRef =
            doc(
                db,
                "users",
                uid
            );

        const snapshot =
            await getDoc(userRef);


        if (!snapshot.exists()) {

            console.error(
                "User profile not found"
            );

            return;
        }


        const data =
            snapshot.data();

        const role =
            data.role;


        document.body.dataset.role =
            role;


    } catch (error) {

        console.error(
            "Failed to load user role:",
            error
        );
    }
}
