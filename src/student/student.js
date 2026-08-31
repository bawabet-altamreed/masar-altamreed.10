// =====================================================
// Masar Al-Tamreed
// Student Core
// =====================================================

import {
    auth,
    db
} from "../firebase/init.js";

import {
    onAuthStateChanged
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// =====================================================
// Student State
// =====================================================

let currentStudent = null;
let currentSubscription = null;


// =====================================================
// Helpers
// =====================================================

export function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


export function formatDate(timestamp) {

    if (!timestamp) {
        return "—";
    }

    try {

        if (
            typeof timestamp.toDate ===
            "function"
        ) {

            return timestamp
                .toDate()
                .toLocaleDateString("ar-EG");

        }

        const date = new Date(timestamp);

        if (isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleDateString("ar-EG");

    } catch {

        return "—";

    }
}


export function formatDateTime(timestamp) {

    if (!timestamp) {
        return "—";
    }

    try {

        const date =
            typeof timestamp.toDate === "function"
                ? timestamp.toDate()
                : new Date(timestamp);

        if (isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleString("ar-EG");

    } catch {

        return "—";

    }
}


export function getDateValue(timestamp) {

    if (!timestamp) {
        return null;
    }

    try {

        if (
            typeof timestamp.toDate ===
            "function"
        ) {

            return timestamp.toDate();

        }

        const date =
            new Date(timestamp);

        return isNaN(date.getTime())
            ? null
            : date;

    } catch {

        return null;

    }
}


// =====================================================
// Subscription Validation
// =====================================================

export function isSubscriptionActive(
    subscription
) {

    if (!subscription) {
        return false;
    }

    if (
        subscription.status !==
        "active"
    ) {

        return false;

    }

    const now =
        new Date();

    const startDate =
        getDateValue(
            subscription.startDate
        );

    const endDate =
        getDateValue(
            subscription.endDate
        );

    if (
        startDate &&
        now < startDate
    ) {

        return false;

    }

    if (
        endDate &&
        now > endDate
    ) {

        return false;

    }

    return true;
}


// =====================================================
// Get Current Student
// =====================================================

export async function getCurrentStudent() {

    const firebaseUser =
        auth.currentUser;

    if (!firebaseUser) {
        throw new Error("NOT_AUTHENTICATED");
    }


    const userRef =
        doc(
            db,
            "users",
            firebaseUser.uid
        );


    const userSnapshot =
        await getDoc(userRef);


    if (
        !userSnapshot.exists()
    ) {

        throw new Error(
            "USER_NOT_FOUND"
        );

    }


    const user =
        userSnapshot.data();


    if (
        user.role !==
        "student"
    ) {

        throw new Error(
            "NOT_STUDENT"
        );

    }


    if (
        user.isActive !== true
    ) {

        throw new Error(
            "ACCOUNT_DISABLED"
        );

    }


    const code =
        String(
            user.subscriptionCode ||
            user.username ||
            ""
        )
        .trim()
        .toUpperCase();


    if (!code) {

        throw new Error(
            "NO_SUBSCRIPTION_CODE"
        );

    }


    const subscriptionRef =
        doc(
            db,
            "subscriptions",
            code
        );


    const subscriptionSnapshot =
        await getDoc(
            subscriptionRef
        );


    if (
        !subscriptionSnapshot.exists()
    ) {

        throw new Error(
            "SUBSCRIPTION_NOT_FOUND"
        );

    }


    const subscription =
        subscriptionSnapshot.data();


    if (
        subscription.userId !==
        firebaseUser.uid
    ) {

        throw new Error(
            "SUBSCRIPTION_MISMATCH"
        );

    }


    if (
        !isSubscriptionActive(
            subscription
        )
    ) {

        throw new Error(
            "SUBSCRIPTION_INACTIVE"
        );

    }


    currentStudent = {
        id: firebaseUser.uid,
        ...user
    };


    currentSubscription = {
        id: code,
        ...subscription
    };


    return {
        firebaseUser,
        student: currentStudent,
        subscription: currentSubscription
    };

}


// =====================================================
// Protect Student Page
// =====================================================

export function protectStudentPage() {

    return new Promise(
        (resolve, reject) => {

            onAuthStateChanged(
                auth,
                async firebaseUser => {

                    if (!firebaseUser) {

                        window.location.href =
                            "../login.html";

                        return;

                    }


                    try {

                        const data =
                            await getCurrentStudent();

                        resolve(data);

                    } catch (error) {

                        console.error(
                            "Student Guard:",
                            error
                        );

                        await auth.signOut();

                        window.location.href =
                            "../login.html";

                        reject(error);

                    }

                }
            );

        }
    );

}


// =====================================================
// Logout
// =====================================================

export async function logoutStudent() {

    await auth.signOut();

    window.location.href =
        "../login.html";

}


// =====================================================
// Student Layout
// =====================================================

export function createStudentLayout(
    student,
    activePage
) {

    const app =
        document.getElementById(
            "studentApp"
        );

    if (!app) {
        return;
    }


    app.innerHTML = `

        <aside class="student-sidebar">

            <div class="student-brand">

                <div class="student-brand-icon">
                    🩺
                </div>

                <div>
                    <strong>
                        مسار التمريض
                    </strong>

                    <small>
                        Masar Al-Tamreed
                    </small>
                </div>

            </div>


            <div class="student-user">

                <div class="student-avatar">
                    ${escapeHtml(
                        String(
                            student.name ||
                            "ط"
                        ).charAt(0)
                    )}
                </div>

                <div>

                    <strong>
                        ${escapeHtml(
                            student.name ||
                            "الطالب"
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(
                            student.stageId ||
                            "—"
                        )}
                    </small>

                </div>

            </div>


            <nav class="student-nav">

                <a
                    href="dashboard.html"
                    class="${activePage === "dashboard" ? "active" : ""}"
                >
                    🏠
                    <span>الرئيسية</span>
                </a>


                <a
                    href="schedule.html"
                    class="${activePage === "schedule" ? "active" : ""}"
                >
                    📅
                    <span>الجدول</span>
                </a>


                <a
                    href="lectures.html"
                    class="${activePage === "lectures" ? "active" : ""}"
                >
                    🎥
                    <span>المحاضرات</span>
                </a>


                <a
                    href="exams.html"
                    class="${activePage === "exams" ? "active" : ""}"
                >
                    📝
                    <span>الاختبارات</span>
                </a>


                <a
                    href="leaderboard.html"
                    class="${activePage === "leaderboard" ? "active" : ""}"
                >
                    🏆
                    <span>الترتيب</span>
                </a>


                <a
                    href="profile.html"
                    class="${activePage === "profile" ? "active" : ""}"
                >
                    👤
                    <span>حسابي</span>
                </a>

            </nav>


            <button
                id="studentLogout"
                class="student-logout"
            >
                🚪 تسجيل الخروج
            </button>

        </aside>


        <main class="student-main">

            <header class="student-header">

                <div>

                    <h1 id="studentPageTitle">
                        مسار التمريض
                    </h1>

                    <p>
                        مرحبًا بك في منصة مسار التمريض
                    </p>

                </div>


                <div class="student-header-user">

                    <span>
                        ${escapeHtml(
                            student.name ||
                            "الطالب"
                        )}
                    </span>

                    <span class="header-avatar">
                        ${escapeHtml(
                            String(
                                student.name ||
                                "ط"
                            ).charAt(0)
                        )}
                    </span>

                </div>

            </header>


            <section
                id="studentPageContent"
                class="student-content"
            ></section>

        </main>

    `;


    const logoutButton =
        document.getElementById(
            "studentLogout"
        );


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            logoutStudent
        );

    }

}


// =====================================================
// Load Collection
// =====================================================

export async function getCollection(
    collectionName
) {

    const snapshot =
        await getDocs(
            collection(
                db,
                collectionName
            )
        );

    return snapshot.docs.map(
        item => ({
            id: item.id,
            ...item.data()
        })
    );

}


// =====================================================
// Get Stage Subjects
// =====================================================

export async function getStageSubjects(
    stageId
) {

    const snapshot =
        await getDocs(
            query(
                collection(
                    db,
                    "subjects"
                ),
                where(
                    "stageId",
                    "==",
                    stageId
                )
            )
        );


    return snapshot.docs.map(
        item => ({
            id: item.id,
            ...item.data()
        })
    );

}


// =====================================================
// Error Message
// =====================================================

export function studentErrorMessage(
    error
) {

    const code =
        error?.message ||
        error?.code ||
        "";


    const messages = {

        NOT_AUTHENTICATED:
            "يجب تسجيل الدخول أولًا.",

        USER_NOT_FOUND:
            "لم يتم العثور على حساب الطالب.",

        NOT_STUDENT:
            "هذا الحساب ليس حساب طالب.",

        ACCOUNT_DISABLED:
            "حسابك موقوف حاليًا.",

        NO_SUBSCRIPTION_CODE:
            "لا يوجد كود اشتراك مرتبط بالحساب.",

        SUBSCRIPTION_NOT_FOUND:
            "لم يتم العثور على الاشتراك.",

        SUBSCRIPTION_MISMATCH:
            "بيانات الاشتراك غير متطابقة.",

        SUBSCRIPTION_INACTIVE:
            "الاشتراك غير فعال أو منتهي.",

        "permission-denied":
            "ليس لديك صلاحية للوصول إلى هذه البيانات."

    };


    return (
        messages[code] ||
        "حدث خطأ أثناء تحميل البيانات."
    );

}
