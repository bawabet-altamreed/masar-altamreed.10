import { auth, db } from "../firebase/init.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* =========================================================
   CURRENT TEACHER
========================================================= */

export let currentTeacher = null;


/* =========================================================
   HELPERS
========================================================= */

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


export function formatDate(value) {
  if (!value) return "-";

  let date;

  if (value?.toDate) {
    date = value.toDate();
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}


export function formatTime(value) {
  if (!value) return "-";

  let date;

  if (value?.toDate) {
    date = value.toDate();
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit"
  });
}


/* =========================================================
   GET TEACHER PROFILE
========================================================= */

export async function getTeacherProfile(uid) {
  if (!uid) return null;

  const userRef = doc(db, "users", uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  if (data.role !== "teacher") {
    return null;
  }

  return {
    id: snapshot.id,
    ...data
  };
}


/* =========================================================
   PROTECT TEACHER PAGE
========================================================= */

export function protectTeacherPage() {
  return new Promise((resolve) => {

    onAuthStateChanged(auth, async (user) => {

      if (!user) {
        window.location.href = "../login.html";
        return;
      }

      try {

        const teacher = await getTeacherProfile(user.uid);

        if (!teacher) {
          await signOut(auth);
          window.location.href = "../login.html";
          return;
        }

        if (teacher.isActive !== true) {
          alert("حساب المعلم غير مفعل حاليًا.");
          await signOut(auth);
          window.location.href = "../login.html";
          return;
        }

        currentTeacher = {
          uid: user.uid,
          email: user.email || "",
          ...teacher
        };

        resolve(currentTeacher);

      } catch (error) {

        console.error("Teacher authorization error:", error);

        await signOut(auth);

        window.location.href = "../login.html";
      }

    });

  });
}


/* =========================================================
   LOGOUT
========================================================= */

export async function logoutTeacher() {

  try {
    await signOut(auth);
    window.location.href = "../login.html";
  } catch (error) {
    console.error(error);
  }

}


/* =========================================================
   GET STAGES
========================================================= */

export async function getStages() {

  const snapshot = await getDocs(
    query(
      collection(db, "stages"),
      orderBy("name")
    )
  );

  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

}


/* =========================================================
   GET SUBJECTS
========================================================= */

export async function getSubjects() {

  const snapshot = await getDocs(
    query(
      collection(db, "subjects"),
      orderBy("name")
    )
  );

  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

}


/* =========================================================
   GET TEACHER LECTURES
========================================================= */

export async function getTeacherLectures(uid) {

  if (!uid) {
    uid = currentTeacher?.uid;
  }

  if (!uid) return [];

  const q = query(
    collection(db, "lectures"),
    where("teacherId", "==", uid)
  );

  const snapshot = await getDocs(q);

  const lectures = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  lectures.sort((a, b) => {

    const dateA = a.date?.toDate
      ? a.date.toDate()
      : new Date(a.date || 0);

    const dateB = b.date?.toDate
      ? b.date.toDate()
      : new Date(b.date || 0);

    return dateB - dateA;
  });

  return lectures;
}


/* =========================================================
   GET TEACHER EXAMS
========================================================= */

export async function getTeacherExams(uid) {

  if (!uid) {
    uid = currentTeacher?.uid;
  }

  if (!uid) return [];

  const q = query(
    collection(db, "exams"),
    where("teacherId", "==", uid)
  );

  const snapshot = await getDocs(q);

  const exams = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  exams.sort((a, b) => {

    const dateA = a.createdAt?.toDate
      ? a.createdAt.toDate()
      : new Date(0);

    const dateB = b.createdAt?.toDate
      ? b.createdAt.toDate()
      : new Date(0);

    return dateB - dateA;
  });

  return exams;
}


/* =========================================================
   GET EXAMS FOR SPECIFIC LECTURE
========================================================= */

export async function getLectureExams(lectureId) {

  if (!lectureId) return [];

  const q = query(
    collection(db, "exams"),
    where("lectureId", "==", lectureId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}


/* =========================================================
   CREATE TEACHER LAYOUT
========================================================= */

export function createTeacherLayout(activePage = "") {

  const container = document.querySelector("#teacher-layout");

  if (!container) return;

  const teacherName =
    currentTeacher?.name ||
    currentTeacher?.fullName ||
    "المعلم";

  container.innerHTML = `

    <aside class="teacher-sidebar">

      <div class="teacher-brand">
        <div class="teacher-logo">🩺</div>

        <div>
          <strong>بوابة التمريض</strong>
          <span>لوحة المعلم</span>
        </div>
      </div>

      <div class="teacher-account">

        <div class="teacher-avatar">
          ${escapeHtml(
            teacherName
              .trim()
              .charAt(0)
              .toUpperCase()
          )}
        </div>

        <div>
          <strong>${escapeHtml(teacherName)}</strong>
          <small>معلم</small>
        </div>

      </div>

      <nav class="teacher-nav">

        <a
          href="dashboard.html"
          class="${activePage === "dashboard" ? "active" : ""}"
        >
          🏠
          <span>الرئيسية</span>
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
          href="profile.html"
          class="${activePage === "profile" ? "active" : ""}"
        >
          👤
          <span>الملف الشخصي</span>
        </a>

      </nav>

      <button id="teacherLogout" class="teacher-logout">
        🚪 تسجيل الخروج
      </button>

    </aside>

    <main class="teacher-main">

      <header class="teacher-topbar">

        <div>
          <h1 id="teacher-page-title">لوحة المعلم</h1>
          <p>إدارة المحاضرات والاختبارات</p>
        </div>

        <div class="teacher-top-user">
          🩺 ${escapeHtml(teacherName)}
        </div>

      </header>

      <section id="teacher-content"></section>

    </main>
  `;

  const logoutButton =
    document.querySelector("#teacherLogout");

  logoutButton?.addEventListener(
    "click",
    logoutTeacher
  );
}


/* =========================================================
   UPDATE TEACHER PROFILE
========================================================= */

export async function updateTeacherProfile(data) {

  if (!currentTeacher?.uid) {
    throw new Error("Teacher not authenticated");
  }

  const userRef = doc(
    db,
    "users",
    currentTeacher.uid
  );

  await updateDoc(userRef, {
    name: data.name,
    email: data.email,
    updatedAt: serverTimestamp()
  });

  currentTeacher.name = data.name;
  currentTeacher.email = data.email;
}


/* =========================================================
   GET RECENT EXAMS
========================================================= */

export async function getRecentExams(uid) {

  const exams = await getTeacherExams(uid);

  return exams.slice(0, 5);
}


/* =========================================================
   GET RECENT LECTURES
========================================================= */

export async function getRecentLectures(uid) {

  const lectures = await getTeacherLectures(uid);

  return lectures.slice(0, 5);
}
