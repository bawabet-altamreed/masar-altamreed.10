import {
    login
} from "../firebase/auth.js";


const form =
    document.getElementById("login-form");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const message =
    document.getElementById("login-message");


form?.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const email =
            emailInput.value.trim();

        const password =
            passwordInput.value;

        message.textContent =
            "جاري تسجيل الدخول...";


        try {

            await login(
                email,
                password
            );

            message.textContent =
                "تم تسجيل الدخول بنجاح";

            window.location.href =
                "/";

        } catch (error) {

            console.error(error);

            message.textContent =
                "بيانات تسجيل الدخول غير صحيحة";
        }
    }
);
