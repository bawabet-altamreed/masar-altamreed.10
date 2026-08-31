// Masar Al-Tamreed
// Admin Layout

import { auth } from "../firebase/init.js";

import {
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


export function createAdminLayout(adminData) {

    const app = document.getElementById("adminApp");

    if (!app) {
        return;
    }

    app.innerHTML = `

        <aside class="admin-sidebar">

            <div class="admin-brand">

                <div class="admin-brand-icon">
                    🩺
                </div>

                <div>
                    <strong>مسار التمريض</strong>
                    <span>لوحة الإدارة</span>
                </div>

            </div>


            <nav class="admin-nav">

                <a href="dashboard.html">
                    📊
                    <span>لوحة التحكم</span>
                </a>

                <a href="students.html">
                    👨‍🎓
                    <span>الطلاب</span>
                </a>

                <a href="teachers.html">
                    👨‍🏫
                    <span>المدرسون</span>
                </a>

                <a href="lectures.html">
                    🎥
                    <span>المحاضرات</span>
                </a>

                <a href="exams.html">
                    📝
                    <span>الاختبارات</span>
                </a>

                <a href="settings.html">
                    ⚙️
                    <span>الإعدادات</span>
                </a>

            </nav>


            <div class="admin-sidebar-footer">

                <button id="logoutButton">
                    🚪 تسجيل الخروج
                </button>

            </div>

        </aside>


        <div class="admin-main">

            <header class="admin-header">

                <div>

                    <h1 id="pageTitle">
                        لوحة الإدارة
                    </h1>

                    <p>
                        إدارة منصة مسار التمريض
                    </p>

                </div>


                <div class="admin-user">

                    <div class="admin-user-icon">
                        👤
                    </div>

                    <div>

                        <strong>
                            ${adminData?.name || "Admin"}
                        </strong>

                        <span>
                            الإدارة
                        </span>

                    </div>

                </div>

            </header>


            <main class="admin-content" id="pageContent">
            </main>

        </div>
    `;


    const logoutButton =
        document.getElementById("logoutButton");


    logoutButton.addEventListener("click", async () => {

        try {

            await signOut(auth);

            window.location.href = "../login.html";

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

        }

    });

}

