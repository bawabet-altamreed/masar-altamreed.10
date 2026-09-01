// ============================================================
// Masar Al-Tamreed
// Firebase Cloud Functions
// Teacher Management
// ============================================================

const {
    onCall,
    HttpsError
} = require("firebase-functions/v2/https");


const {
    initializeApp
} = require("firebase-admin/app");


const {
    getAuth
} = require("firebase-admin/auth");


const {
    getFirestore,
    FieldValue
} = require("firebase-admin/firestore");


// ============================================================
// Initialize Firebase Admin
// ============================================================

initializeApp();


const adminAuth =
    getAuth();


const db =
    getFirestore();


// ============================================================
// Helpers
// ============================================================

function isValidString(value) {

    return (
        typeof value === "string" &&
        value.trim().length > 0
    );

}


function normalizeArray(value) {

    if (!Array.isArray(value)) {
        return [];
    }


    return [
        ...new Set(
            value
                .filter(
                    item =>
                        typeof item === "string"
                )
                .map(
                    item =>
                        item.trim()
                )
                .filter(
                    item =>
                        item.length > 0
                )
        )
    ];

}


function normalizeEmail(email) {

    return String(email)
        .trim()
        .toLowerCase();

}


// ============================================================
// Check Admin
// ============================================================

async function verifyAdmin(request) {

    if (!request.auth) {

        throw new HttpsError(
            "unauthenticated",
            "يجب تسجيل الدخول أولًا."
        );

    }


    const adminUid =
        request.auth.uid;


    const adminRef =
        db.collection("users")
            .doc(adminUid);


    const adminSnapshot =
        await adminRef.get();


    if (!adminSnapshot.exists) {

        throw new HttpsError(
            "permission-denied",
            "حساب الإدارة غير موجود."
        );

    }


    const adminData =
        adminSnapshot.data();


    if (
        adminData.role !== "admin" ||
        adminData.isActive !== true
    ) {

        throw new HttpsError(
            "permission-denied",
            "ليس لديك صلاحية تنفيذ هذه العملية."
        );

    }


    return adminData;

}


// ============================================================
// Create Teacher
// ============================================================

exports.createTeacher =
    onCall(
        {
            region: "us-central1"
        },

        async request => {

            // ------------------------------------------------
            // 1. Verify Admin
            // ------------------------------------------------

            await verifyAdmin(request);


            // ------------------------------------------------
            // 2. Read Data
            // ------------------------------------------------

            const data =
                request.data || {};


            const name =
                isValidString(data.name)
                ? data.name.trim()
                : "";


            const email =
                isValidString(data.email)
                ? normalizeEmail(data.email)
                : "";


            const password =
                typeof data.password === "string"
                ? data.password
                : "";


            const stageIds =
                normalizeArray(
                    data.stageIds
                );


            const subjectIds =
                normalizeArray(
                    data.subjectIds
                );


            const isActive =
                data.isActive !== false;


            // ------------------------------------------------
            // 3. Validation
            // ------------------------------------------------

            if (!name) {

                throw new HttpsError(
                    "invalid-argument",
                    "اسم المعلم مطلوب."
                );

            }


            if (!email) {

                throw new HttpsError(
                    "invalid-argument",
                    "البريد الإلكتروني مطلوب."
                );

            }


            if (
                !email.includes("@") ||
                email.length > 254
            ) {

                throw new HttpsError(
                    "invalid-argument",
                    "البريد الإلكتروني غير صالح."
                );

            }


            if (password.length < 6) {

                throw new HttpsError(
                    "invalid-argument",
                    "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
                );

            }


            if (password.length > 128) {

                throw new HttpsError(
                    "invalid-argument",
                    "كلمة المرور طويلة جدًا."
                );

            }


            if (stageIds.length === 0) {

                throw new HttpsError(
                    "invalid-argument",
                    "يجب اختيار مرحلة واحدة على الأقل."
                );

            }


            if (subjectIds.length === 0) {

                throw new HttpsError(
                    "invalid-argument",
                    "يجب اختيار مادة واحدة على الأقل."
                );

            }


            // ------------------------------------------------
            // 4. Validate Stages
            // ------------------------------------------------

            const stageChecks =
                await Promise.all(
                    stageIds.map(
                        stageId =>
                            db.collection("stages")
                                .doc(stageId)
                                .get()
                    )
                );


            const invalidStage =
                stageChecks.find(
                    snapshot =>
                        !snapshot.exists
                );


            if (invalidStage) {

                throw new HttpsError(
                    "invalid-argument",
                    "يوجد Stage ID غير صالح."
                );

            }


            // ------------------------------------------------
            // 5. Validate Subjects
            // ------------------------------------------------

            const subjectChecks =
                await Promise.all(
                    subjectIds.map(
                        subjectId =>
                            db.collection("subjects")
                                .doc(subjectId)
                                .get()
                    )
                );


            const invalidSubject =
                subjectChecks.find(
                    snapshot =>
                        !snapshot.exists
                );


            if (invalidSubject) {

                throw new HttpsError(
                    "invalid-argument",
                    "يوجد Subject ID غير صالح."
                );

            }


            // ------------------------------------------------
            // 6. Create Firebase Authentication User
            // ------------------------------------------------

            let userRecord;


            try {

                userRecord =
                    await adminAuth.createUser({

                        email,

                        password,

                        displayName:
                            name,

                        disabled:
                            !isActive

                    });

            } catch (error) {

                console.error(
                    "Firebase Auth createUser error:",
                    error
                );


                if (
                    error.code ===
                    "auth/email-already-exists"
                ) {

                    throw new HttpsError(
                        "already-exists",
                        "هذا البريد الإلكتروني مستخدم بالفعل."
                    );

                }


                if (
                    error.code ===
                    "auth/invalid-email"
                ) {

                    throw new HttpsError(
                        "invalid-argument",
                        "البريد الإلكتروني غير صالح."
                    );

                }


                if (
                    error.code ===
                    "auth/invalid-password"
                ) {

                    throw new HttpsError(
                        "invalid-argument",
                        "كلمة المرور غير صالحة."
                    );

                }


                throw new HttpsError(
                    "internal",
                    "فشل إنشاء حساب Firebase Authentication."
                );

            }


            // ------------------------------------------------
            // 7. Create Firestore Teacher Profile
            // ------------------------------------------------

            try {

                await db
                    .collection("users")
                    .doc(userRecord.uid)
                    .set({

                        role: "teacher",

                        name,

                        email,

                        isActive,

                        stageIds,

                        subjectIds,

                        createdAt:
                            FieldValue.serverTimestamp(),

                        updatedAt:
                            FieldValue.serverTimestamp()

                    });

            } catch (error) {

                console.error(
                    "Firestore teacher profile error:",
                    error
                );


                // --------------------------------------------
                // Rollback Auth User
                // --------------------------------------------

                try {

                    await adminAuth.deleteUser(
                        userRecord.uid
                    );

                } catch (rollbackError) {

                    console.error(
                        "Teacher rollback failed:",
                        rollbackError
                    );

                }


                throw new HttpsError(
                    "internal",
                    "فشل إنشاء ملف المعلم."
                );

            }


            // ------------------------------------------------
            // 8. Return Result
            // ------------------------------------------------

            return {

                success: true,

                uid:
                    userRecord.uid,

                teacher: {

                    name,

                    email,

                    role: "teacher",

                    isActive,

                    stageIds,

                    subjectIds

                }

            };

        }
    );


// ============================================================
// Update Teacher Status
// ============================================================

exports.setTeacherActive =
    onCall(
        {
            region: "us-central1"
        },

        async request => {

            await verifyAdmin();


            const data =
                request.data || {};


            const uid =
                typeof data.uid === "string"
                ? data.uid.trim()
                : "";


            const isActive =
                data.isActive === true;


            if (!uid) {

                throw new HttpsError(
                    "invalid-argument",
                    "معرف المعلم مطلوب."
                );

            }


            const teacherRef =
                db.collection("users")
                    .doc(uid);


            const teacherSnapshot =
                await teacherRef.get();


            if (!teacherSnapshot.exists) {

                throw new HttpsError(
                    "not-found",
                    "المعلم غير موجود."
                );

            }


            const teacherData =
                teacherSnapshot.data();


            if (
                teacherData.role !==
                "teacher"
            ) {

                throw new HttpsError(
                    "failed-precondition",
                    "هذا المستخدم ليس معلمًا."
                );

            }


            // Update Authentication

            await adminAuth.updateUser(
                uid,
                {
                    disabled:
                        !isActive
                }
            );


            // Update Firestore

            await teacherRef.update({

                isActive,

                updatedAt:
                    FieldValue.serverTimestamp()

            });


            return {

                success: true,

                uid,

                isActive

            };

        }
    );
