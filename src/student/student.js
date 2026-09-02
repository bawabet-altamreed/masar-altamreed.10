// =====================================================
// Student Core
// Masar Al-Tamreed
// =====================================================

import {
    auth,
    db
} from "../firebase/init.js";

import {
    onAuthStateChanged,
    signOut
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
// State
// =====================================================

let currentStudent = null;
let currentSubscription = null;


// =====================================================
// Escape HTML
// =====================================================

export function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// =====================================================
// Date Helpers
// =====================================================

export function getDateValue(value) {

    if (!value) {
        return null;
    }

    if (
        typeof value.toDate === "function"
    ) {
        return value.toDate();
    }

    if (
        typeof value.toMillis === "function"
    ) {
        return new Date(value.toMillis());
    }

    if (
        value.seconds !== undefined
    ) {
        return new Date(
            Number(value.seconds) * 1000
        );
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(date.getTime())
    ) {
        return null;
    }

    return date;

}


export function formatDate(value) {

    const date =
        getDateValue(value);

    if (!date) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "ar-EG",
        {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    ).format(date);

}


export function formatDateTime(value) {

    const date =
        getDateValue(value);

    if (!date) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "ar-EG",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    ).format(date);

}


export function formatTime(value) {

    const date =
        getDateValue(value);

    if (!date) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "ar-EG",
        {
            hour: "numeric",
            minute: "2-digit"
        }
    ).format(date);

}


// =====================================================
// Subscription
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

    const start =
        getDateValue(
            subscription.startDate
        );

    const end =
        getDateValue(
            subscription.endDate
        );

    if (
        !start ||
        !end
    ) {
        return false;
    }

    return (
        start <= now &&
        end >= now
    );

}


// =====================================================
// Current Student
// =====================================================

export async function getCurrentStudent() {

    const firebaseUser =
        auth.currentUser;

    if (!firebaseUser) {

        throw new Error(
            "AUTH_REQUIRED"
        );

    }


    const userRef =
        doc(
            db,
            "users",
            firebaseUser.uid
        );


    const userSnapshot =
        await getDoc(
            userRef
        );


    if (!userSnapshot.exists()) {

        throw new Error(
            "STUDENT_PROFILE_NOT_FOUND"
        );

    }


    const student =
        userSnapshot.data();


    if (
        student.role !==
        "student"
    ) {

        throw new Error(
            "NOT_STUDENT"
        );

    }


    if (
        student.isActive !==
        true
    ) {

        throw new Error(
            "STUDENT_INACTIVE"
        );

    }


    if (
        !student.stageId
    ) {

        throw new Error(
            "STAGE_NOT_ASSIGNED"
        );

    }


    const subscriptionCode =
        student.subscriptionCode ||
        student.username;


    if (!subscriptionCode) {

        throw new Error(
            "SUBSCRIPTION_REQUIRED"
        );

    }


    const subscriptionRef =
        doc(
            db,
            "subscriptions",
            subscriptionCode
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
            "SUBSCRIPTION_NOT_BELONG_TO_STUDENT"
        );

    }


    if (
        !isSubscriptionActive(
            subscription
        )
    ) {

        throw new Error(
            "SUBSCRIPTION_EXPIRED"
        );

    }


    currentStudent = {
        ...student,
        id: firebaseUser.uid
    };

    currentSubscription = {
        ...subscription,
        id: subscriptionCode
    };


    return {

        firebaseUser,

        student:
            currentStudent,

        subscription:
            currentSubscription

    };

}


// =====================================================
// Protect Student Page
// =====================================================

export async function protectStudentPage() {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            let finished = false;


            const unsubscribe =
                onAuthStateChanged(
                    auth,
                    async user => {

                        if (!user) {

                            if (!finished) {

                                finished = true;

                                unsubscribe();

                                window.location.href =
                                    "../login.html";

                            }

                            return;

                        }


                        try {

                            const result =
                                await getCurrentStudent();


                            if (!finished) {

                                finished = true;

                                unsubscribe();

                                resolve(
                                    result
                                );

                            }

                        } catch (error) {

                            console.error(
                                "Student protection error:",
                                error
                            );


                            if (!finished) {

                                finished = true;

                                unsubscribe();

                                try {
                                    await signOut(auth);
                                } catch {}

                                window.location.href =
                                    "../login.html";
                            }

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

    await signOut(auth);

    window.location.href =
        "../login.html";

}



// =====================================================
// Student Layout
// =====================================================

export function createStudentLayout(
    student,
    activePage = ""
) {

    const app =
        document.getElementById(
            "studentApp"
        );

    if (!app) {
        return;
    }


    const name =
        student.name ||
        student.fullName ||
        student.username ||
        "الطالب";


    const initial =
        String(name)
            .trim()
            .charAt(0) ||
        "ط";


    const stage =
        student.stageName ||
        student.stageId ||
        "غير محدد";


    app.innerHTML = `

        <div class="student-app">

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
                            MASAR AL-TAMREED
                        </small>

                    </div>

                </div>


                <div class="student-user">

                    <div class="student-avatar">

                        ${escapeHtml(initial)}

                    </div>

                    <div>

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <small>
                            ${escapeHtml(stage)}
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
                        🎓
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
                        <span>نتائجي</span>
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
                    type="button"
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

                        <p id="studentPageSubtitle">
                            منصة التعلم الخاصة بك
                        </p>

                    </div>


                    <div class="student-header-user">

                        <div class="header-avatar">

                            ${escapeHtml(initial)}

                        </div>

                        ${escapeHtml(name)}

                    </div>

                </header>


                <section
                    id="studentPageContent"
                    class="student-content"
                >

                </section>

            </main>

        </div>

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
// Collections
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
// Stages
// =====================================================

export async function getStages() {

    const snapshot =
        await getDocs(
            collection(
                db,
                "stages"
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
// Subjects
// =====================================================

export async function getSubjects() {

    const snapshot =
        await getDocs(
            collection(
                db,
                "subjects"
            )
        );

    return snapshot.docs.map(
        item => ({
            id: item.id,
            ...item.data()
        })
    );

}


export async function getStageSubjects(
    stageId
) {

    const subjects =
        await getSubjects();


    return subjects.filter(
        subject =>
            !subject.stageId ||
            subject.stageId === stageId
    );

}


// =====================================================
// Student Lectures
// =====================================================

export async function getStudentLectures(
    stageId
) {

    const q =
        query(
            collection(
                db,
                "lectures"
            ),

            where(
                "stageId",
                "==",
                stageId
            ),

            where(
                "isPublished",
                "==",
                true
            )
        );


    const snapshot =
        await getDocs(q);


    return snapshot.docs.map(
        item => ({
            id: item.id,
            ...item.data()
        })
    );

}


// =====================================================
// Student Exams
// =====================================================

export async function getStudentExams(
    stageId
) {

    const q =
        query(
            collection(
                db,
                "exams"
            ),

            where(
                "stageId",
                "==",
                stageId
            ),

            where(
                "isPublished",
                "==",
                true
            )
        );


    const snapshot =
        await getDocs(q);


    return snapshot.docs.map(
        item => ({
            id: item.id,
            ...item.data()
        })
    );

}


// =====================================================
// Lecture Exams
// =====================================================

export async function getLectureExams(
    lectureId
) {

    const q =
        query(
            collection(
                db,
                "exams"
            ),

            where(
                "lectureId",
                "==",
                lectureId
            ),

            where(
                "isPublished",
                "==",
                true
            )
        );


    const snapshot =
        await getDocs(q);


    return snapshot.docs.map(
        item => ({
            id: item.id,
            ...item.data()
        })
    );

}


// =====================================================
// Student Results
// =====================================================

export async function getStudentResults(
    studentId
) {

    const q =
        query(
            collection(
                db,
                "examResults"
            ),

            where(
                "studentId",
                "==",
                studentId
            )
        );


    const snapshot =
        await getDocs(q);


    return snapshot.docs.map(
        item => ({
            id: item.id,
            ...item.data()
        })
    );

}


// =====================================================
// Recent Results
// =====================================================

export async function getRecentResults(
    studentId,
    limit = 5
) {

    const results =
        await getStudentResults(
            studentId
        );


    results.sort(
        (
            a,
            b
        ) =>
            getTimestamp(
                b.submittedAt
            ) -
            getTimestamp(
                a.submittedAt
            )
    );


    return results.slice(
        0,
        limit
    );

}


// =====================================================
// Recent Lectures
// =====================================================

export async function getRecentLectures(
    stageId,
    limit = 5
) {

    const lectures =
        await getStudentLectures(
            stageId
        );


    lectures.sort(
        (
            a,
            b
        ) =>
            getTimestamp(
                a.date
            ) -
            getTimestamp(
                b.date
            )
    );


    return lectures.slice(
        0,
        limit
    );

}


// =====================================================
// Recent Exams
// =====================================================

export async function getRecentExams(
    stageId,
    limit = 5
) {

    const exams =
        await getStudentExams(
            stageId
        );


    exams.sort(
        (
            a,
            b
        ) =>
            getTimestamp(
                b.createdAt
            ) -
            getTimestamp(
                a.createdAt
            )
    );


    return exams.slice(
        0,
        limit
    );

}


// =====================================================
// Timestamp
// =====================================================

export function getTimestamp(
    value
) {

    const date =
        getDateValue(value);

    if (!date) {
        return 0;
    }

    return date.getTime();

}


// =====================================================
// Error Message
// =====================================================

export function studentErrorMessage(
    error
) {

    const code =
        error?.code ||
        error?.message ||
        "";


    if (
        code.includes(
            "permission-denied"
        )
    ) {

        return "ليس لديك صلاحية للوصول إلى هذه البيانات.";

    }


    switch (code) {

        case "AUTH_REQUIRED":
            return "يجب تسجيل الدخول أولًا.";

        case "STUDENT_PROFILE_NOT_FOUND":
            return "لم يتم العثور على حساب الطالب.";

        case "NOT_STUDENT":
            return "هذا الحساب ليس حساب طالب.";

        case "STUDENT_INACTIVE":
            return "حساب الطالب غير مفعل.";

        case "STAGE_NOT_ASSIGNED":
            return "لم يتم تحديد المرحلة الدراسية للحساب.";

        case "SUBSCRIPTION_REQUIRED":
            return "لا يوجد اشتراك مرتبط بالحساب.";

        case "SUBSCRIPTION_NOT_FOUND":
            return "الاشتراك غير موجود.";

        case "SUBSCRIPTION_NOT_BELONG_TO_STUDENT":
            return "الاشتراك غير مرتبط بهذا الحساب.";

        case "SUBSCRIPTION_EXPIRED":
            return "الاشتراك غير نشط أو انتهت صلاحيته.";

        default:
            return error?.message ||
                "حدث خطأ غير متوقع.";
    }

}


// =====================================================
// Current Teacher-style compatibility exports
// =====================================================

export {
    currentStudent
};
