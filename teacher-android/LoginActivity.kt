package com.masaraltamreed.teacher

import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

class LoginActivity : AppCompatActivity() {

    private val auth by lazy { FirebaseAuth.getInstance() }
    private val db by lazy { FirebaseFirestore.getInstance() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (auth.currentUser != null) {
            verifyTeacherAndOpen()
            return
        }

        setContentView(R.layout.activity_login)

        val email = findViewById<EditText>(R.id.emailInput)
        val password = findViewById<EditText>(R.id.passwordInput)
        val button = findViewById<Button>(R.id.loginButton)
        val progress = findViewById<ProgressBar>(R.id.loginProgress)
        val message = findViewById<TextView>(R.id.loginMessage)

        button.setOnClickListener {
            val e = email.text.toString().trim()
            val p = password.text.toString()

            if (e.isEmpty() || p.isEmpty()) {
                message.text = "اكتب البريد الإلكتروني وكلمة المرور."
                return@setOnClickListener
            }

            button.isEnabled = false
            progress.visibility = android.view.View.VISIBLE
            message.text = ""

            auth.signInWithEmailAndPassword(e, p)
                .addOnSuccessListener {
                    verifyTeacherAndOpen()
                }
                .addOnFailureListener {
                    button.isEnabled = true
                    progress.visibility = android.view.View.GONE
                    message.text = "فشل تسجيل الدخول: ${it.message ?: "بيانات غير صحيحة"}"
                }
        }
    }

    private fun verifyTeacherAndOpen() {
        val user = auth.currentUser ?: run {
            showLogin()
            return
        }

        db.collection("users").document(user.uid).get()
            .addOnSuccessListener { snap ->
                val role = snap.getString("role")
                val active = snap.getBoolean("isActive") == true

                if (role == "teacher" && active) {
                    startActivity(Intent(this, LectureListActivity::class.java))
                    finish()
                } else {
                    auth.signOut()
                    Toast.makeText(
                        this,
                        "هذا الحساب ليس حساب مدرس مفعل.",
                        Toast.LENGTH_LONG
                    ).show()
                    showLogin()
                }
            }
            .addOnFailureListener {
                Toast.makeText(
                    this,
                    "تعذر التحقق من حساب المدرس.",
                    Toast.LENGTH_LONG
                ).show()
                showLogin()
            }
    }

    private fun showLogin() {
        setContentView(R.layout.activity_login)
    }
}
