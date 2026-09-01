// ============================================================
// BOABAT AL TAMREED
// TEACHER SYSTEM
// ============================================================

import {
    auth,
    db
} from "../firebase/firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// GLOBAL TEACHER
// ============================================================

let currentTeacher = null;


// ============================================================
// ESCAPE HTML
// ============================================================

export function escapeHtml(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// DATE FORMAT
// ============================================================

export function formatDate(timestamp) {

    if (!timestamp) {
        return "غير محدد";
    }

    try {

        const date = timestamp.toDate
            ? timestamp.toDate()
            : new Date(timestamp);

        return date.toLocaleDateString("ar-EG", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });

    } catch {

        return "غير محدد";
    }
}


// ============================================================
// TIME FORMAT
// ============================================================

export function formatTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    try {

        const date = timestamp.toDate
            ? timestamp.toDate()
            : new Date(timestamp);

        return date.toLocaleTimeString("ar-EG", {
            hour: "2-digit",
            minute: "2-digit"
        });

    } catch {

        return "";
    }
}


// ============================================================
// GET TEACHER PROFILE
// ============================================================

export async function getTeacherProfile(uid) {

    const ref = doc(db, "users", uid);

    const snap = await getDoc(ref);

    if (!snap.exists()) {
        throw new Error("لم يتم العثور على بيانات المعلم");
    }

    const data = snap.data();

    if (data.role !== "teacher") {
        throw new Error("هذا الحساب ليس حساب معلم");
    }

    if (data.isActive === false) {
        throw new Error("حساب المعلم غير مفعل");
    }

    return {
        uid,
        ...data
    };
}


// ============================================================
// PROTECT TEACHER PAGE
// ============================================================

export function protectTeacherPage(callback) {

    onAuthStateChanged(auth, async (user) => {

        if (!user) {

            window.location.href = "./login.html";
            return;
        }

        try {

            const teacher = await getTeacherProfile(user.uid);

            currentTeacher = teacher;

            window.currentTeacher = teacher;

            if (typeof callback === "function") {
                await callback(teacher);
            }

        } catch (error) {

            console.error(error);

            await signOut(auth);

            window.location.href = "./login.html";
        }
    });
}


// ============================================================
// LOGOUT
// ============================================================

export async function logoutTeacher() {

    try {

        await signOut(auth);

        window.location.href = "./login.html";

    } catch (error) {

        console.error(error);

        alert("حدث خطأ أثناء تسجيل الخروج");
    }
}


// ============================================================
// TEACHER LAYOUT
// ============================================================

export function createTeacherLayout(
    teacher,
    activePage = "dashboard"
) {

    const teacherName =
        teacher?.name ||
        teacher?.displayName ||
        teacher?.fullName ||
        "المعلم";

    const container =
        document.getElementById("teacherLayout");

    if (!container) {
        return;
    }

    container.innerHTML = `

        <header class="teacher-header">

            <div class="header-right">

                <button
                    class="menu-button"
                    id="menuButton"
                    type="button"
                >
                    ☰
                </button>

                <div class="brand">

                    <div class="brand-icon">
                        🩺
                    </div>

                    <div>
                        <h2>بوابة التمريض</h2>
                        <span>لوحة تحكم المعلم</span>
                    </div>

                </div>

            </div>

            <div class="teacher-mini-profile">

                <div class="teacher-avatar">
                    ${escapeHtml(
                        teacherName
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>

                <div class="teacher-mini-info">

                    <strong>
                        ${escapeHtml(teacherName)}
                    </strong>

                    <span>
                        معلم
                    </span>

                </div>

            </div>

        </header>


        <div class="teacher-system">


            <aside
                class="teacher-sidebar"
                id="teacherSidebar"
            >

                <div class="sidebar-profile">

                    <div class="large-avatar">
                        ${escapeHtml(
                            teacherName
                                .charAt(0)
                                .toUpperCase()
                        )}
                    </div>

                    <strong>
                        ${escapeHtml(teacherName)}
                    </strong>

                    <span>
                        مدرس / معلم
                    </span>

                </div>


                <nav class="teacher-nav">

                    <a
                        href="./dashboard.html"
                        class="${activePage === "dashboard" ? "active" : ""}"
                    >
                        <span>🏠</span>
                        الرئيسية
                    </a>


                    <a
                        href="./lectures.html"
                        class="${activePage === "lectures" ? "active" : ""}"
                    >
                        <span>🎥</span>
                        المحاضرات
                    </a>


                    <a
                        href="./exams.html"
                        class="${activePage === "exams" ? "active" : ""}"
                    >
                        <span>📝</span>
                        الاختبارات
                    </a>


                    <a
                        href="./profile.html"
                        class="${activePage === "profile" ? "active" : ""}"
                    >
                        <span>👤</span>
                        حسابي
                    </a>


                    <div class="nav-divider"></div>


                    <button
                        type="button"
                        id="logoutTeacher"
                        class="logout-button"
                    >
                        <span>🚪</span>
                        تسجيل الخروج
                    </button>

                </nav>

            </aside>


            <main class="teacher-main">

                <div class="teacher-content">

                    ${document.getElementById("teacherContent")
                        ?.innerHTML || ""}

                </div>

            </main>

        </div>
    `;


    // Mobile menu

    const menuButton =
        document.getElementById("menuButton");

    const sidebar =
        document.getElementById("teacherSidebar");

    if (menuButton && sidebar) {

        menuButton.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle("open");

            }
        );
    }


    // Logout

    const logoutButton =
        document.getElementById("logoutTeacher");

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            logoutTeacher
        );
    }
}


// ============================================================
// LOAD TEACHER LECTURES
// ============================================================

export async function getTeacherLectures(
    teacherId
) {

    const lecturesRef =
        collection(db, "lectures");

    const q = query(
        lecturesRef,
        where("teacherId", "==", teacherId)
    );

    const snapshot =
        await getDocs(q);

    const lectures = [];

    snapshot.forEach((docSnap) => {

        lectures.push({
            id: docSnap.id,
            ...docSnap.data()
        });

    });

    lectures.sort((a, b) => {

        const aDate =
            a.createdAt?.toMillis?.() || 0;

        const bDate =
            b.createdAt?.toMillis?.() || 0;

        return bDate - aDate;
    });

    return lectures;
}


// ============================================================
// LOAD TEACHER EXAMS
// ============================================================

export async function getTeacherExams(
    teacherId
) {

    const examsRef =
        collection(db, "exams");

    const q = query(
        examsRef,
        where("teacherId", "==", teacherId)
    );

    const snapshot =
        await getDocs(q);

    const exams = [];

    snapshot.forEach((docSnap) => {

        exams.push({
            id: docSnap.id,
            ...docSnap.data()
        });

    });

    exams.sort((a, b) => {

        const aDate =
            a.createdAt?.toMillis?.() || 0;

        const bDate =
            b.createdAt?.toMillis?.() || 0;

        return bDate - aDate;
    });

    return exams;
}


// ============================================================
// STAGES
// ============================================================

export async function getStages() {

    const snapshot =
        await getDocs(
            collection(db, "stages")
        );

    const stages = [];

    snapshot.forEach((docSnap) => {

        stages.push({
            id: docSnap.id,
            ...docSnap.data()
        });

    });

    return stages;
}


// ============================================================
// SUBJECTS
// ============================================================

export async function getSubjects() {

    const snapshot =
        await getDocs(
            collection(db, "subjects")
        );

    const subjects = [];

    snapshot.forEach((docSnap) => {

        subjects.push({
            id: docSnap.id,
            ...docSnap.data()
        });

    });

    return subjects;
}


// ============================================================
// EXPORT
// ============================================================

export {
    currentTeacher
};
