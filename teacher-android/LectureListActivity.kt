package com.masaraltamreed.teacher

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

data class TeacherLecture(
    val id: String,
    val title: String,
    val subjectId: String,
    val stageId: String,
    val roomName: String,
    val isPublished: Boolean,
    val isLive: Boolean
)

class LectureListActivity : AppCompatActivity() {

    private val auth by lazy { FirebaseAuth.getInstance() }
    private val db by lazy { FirebaseFirestore.getInstance() }

    private lateinit var listView: ListView
    private lateinit var progress: ProgressBar
    private lateinit var emptyText: TextView
    private val lectures = mutableListOf<TeacherLecture>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_lecture_list)

        listView = findViewById(R.id.lectureList)
        progress = findViewById(R.id.listProgress)
        emptyText = findViewById(R.id.emptyText)

        findViewById<Button>(R.id.logoutButton).setOnClickListener {
            auth.signOut()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        loadLectures()
    }

    override fun onResume() {
        super.onResume()
        if (::listView.isInitialized) loadLectures()
    }

    private fun loadLectures() {
        val uid = auth.currentUser?.uid ?: run {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        progress.visibility = View.VISIBLE
        emptyText.visibility = View.GONE

        db.collection("lectures")
            .whereEqualTo("teacherId", uid)
            .get()
            .addOnSuccessListener { result ->
                lectures.clear()

                for (doc in result.documents) {
                    lectures.add(
                        TeacherLecture(
                            id = doc.id,
                            title = doc.getString("title") ?: "محاضرة بدون عنوان",
                            subjectId = doc.getString("subjectId") ?: "",
                            stageId = doc.getString("stageId") ?: "",
                            roomName = doc.getString("roomName") ?: "",
                            isPublished = doc.getBoolean("isPublished") == true,
                            isLive = doc.getBoolean("isLive") == true
                        )
                    )
                }

                lectures.sortByDescending { it.isLive }

                val labels = lectures.map {
                    val live = if (it.isLive) "🔴 مباشر" else "⚪ غير مباشر"
                    "${it.title}\n$live • ${it.stageId}"
                }

                listView.adapter = ArrayAdapter(
                    this,
                    android.R.layout.simple_list_item_2,
                    android.R.id.text1,
                    labels
                )

                listView.setOnItemClickListener { _, _, position, _ ->
                    val lecture = lectures[position]
                    if (lecture.roomName.isBlank()) {
                        Toast.makeText(
                            this,
                            "هذه المحاضرة لا تحتوي على roomName.",
                            Toast.LENGTH_LONG
                        ).show()
                        return@setOnItemClickListener
                    }

                    val intent = Intent(
                        this,
                        LiveLectureActivity::class.java
                    )
                    intent.putExtra("lectureId", lecture.id)
                    startActivity(intent)
                }

                emptyText.visibility =
                    if (lectures.isEmpty()) View.VISIBLE else View.GONE
            }
            .addOnFailureListener {
                Toast.makeText(
                    this,
                    "تعذر تحميل المحاضرات: ${it.message}",
                    Toast.LENGTH_LONG
                ).show()
            }
            .addOnCompleteListener {
                progress.visibility = View.GONE
            }
    }
}
