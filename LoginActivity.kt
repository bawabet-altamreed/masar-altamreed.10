package com.masaraltamreed.teacher

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class LoginActivity : AppCompatActivity() {

    private lateinit var auth: FirebaseAuth
    private lateinit var db: FirebaseFirestore

    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var loginButton: Button
    private lateinit var errorText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_login)

        auth = FirebaseAuth.getInstance()
        db = FirebaseFirestore.getInstance()

        emailInput = findViewById(R.id.emailInput)
        passwordInput = findViewById(R.id.passwordInput)
        loginButton = findViewById(R.id.loginButton)
        errorText = findViewById(R.id.errorText)

        loginButton.setOnClickListener {
            login()
        }
    }

    private fun login() {

        val email =
            emailInput.text.toString().trim()

        val password =
            passwordInput.text.toString()

        if (email.isEmpty()) {
            emailInput.error = "اكتب البريد الإلكتروني"
            return
        }

        if (password.isEmpty()) {
            passwordInput.error = "اكتب كلمة المرور"
            return
        }

        loginButton.isEnabled = false

        lifecycleScope.launch {

            try {

                val result =
                    auth.signInWithEmailAndPassword(
                        email,
                        password
                    ).await()

                val firebaseUser =
                    result.user
                        ?: throw Exception(
                            "تعذر الحصول على حساب المستخدم"
                        )

                val snapshot =
                    db.collection("users")
                        .document(firebaseUser.uid)
                        .get()
                        .await()

                if (!snapshot.exists()) {
                    throw Exception(
                        "حساب المدرس غير موجود في النظام"
                    )
                }

                val data =
                    snapshot.data
                        ?: throw Exception(
                            "بيانات الحساب غير موجودة"
                        )

                val role =
                    data["role"] as? String

                val isActive =
                    data["isActive"] as? Boolean ?: false

                if (role != "teacher") {
                    auth.signOut()

                    throw Exception(
                        "هذا الحساب ليس حساب مدرس"
                    )
                }

                if (!isActive) {
                    auth.signOut()

                    throw Exception(
                        "حساب المدرس غير مفعل حاليًا"
                    )
                }

                val intent =
                    Intent(
                        this@LoginActivity,
                        MainActivity::class.java
                    )

                startActivity(intent)

                finish()

            } catch (error: Exception) {

                loginButton.isEnabled = true

                errorText.text =
                    error.message
                        ?: "تعذر تسجيل الدخول"
            }
        }
    }
}
