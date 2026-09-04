package com.masaraltamreed.teacher

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import io.livekit.android.room.Room
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.Track
import io.livekit.android.token.TokenRequestOptions
import io.livekit.android.token.TokenSource
import io.livekit.android.room.track.video.CameraPosition

class LiveLectureActivity : AppCompatActivity() {

    companion object {
        private const val SCREEN_CAPTURE_REQUEST = 9001
        private const val TOKEN_SERVER_ID = "masaraltamreed-5uoy7c"
    }

    private val auth by lazy { FirebaseAuth.getInstance() }
    private val db by lazy { FirebaseFirestore.getInstance() }

    private lateinit var lectureTitle: TextView
    private lateinit var status: TextView
    private lateinit var startButton: Button
    private lateinit var cameraButton: Button
    private lateinit var shareButton: Button
    private lateinit var endButton: Button

    private var lectureId: String = ""
    private var roomName: String = ""
    private var room: Room? = null
    private var videoTrack: LocalVideoTrack? = null
    private var screenShareActive = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_live_lecture)

        lectureTitle = findViewById(R.id.lectureTitle)
        status = findViewById(R.id.statusText)
        startButton = findViewById(R.id.startButton)
        cameraButton = findViewById(R.id.cameraButton)
        shareButton = findViewById(R.id.shareButton)
        endButton = findViewById(R.id.endButton)

        lectureId = intent.getStringExtra("lectureId").orEmpty()

        if (lectureId.isBlank()) {
            finishWithError("معرّف المحاضرة غير موجود.")
            return
        }

        startButton.setOnClickListener { startBroadcast() }
        cameraButton.setOnClickListener { switchCamera() }
        shareButton.setOnClickListener { requestScreenShare() }
        endButton.setOnClickListener { endBroadcast() }

        loadLecture()
    }

    private fun loadLecture() {
        val uid = auth.currentUser?.uid ?: run {
            finishWithError("جلسة تسجيل الدخول غير موجودة.")
            return
        }

        status.text = "جاري التحقق من المحاضرة..."

        db.collection("users").document(uid).get()
            .addOnSuccessListener { userSnap ->
                val role = userSnap.getString("role")
                val active = userSnap.getBoolean("isActive") == true

                if (role != "teacher" || !active) {
                    finishWithError("حساب المدرس غير مفعل.")
                    return@addOnSuccessListener
                }

                db.collection("lectures").document(lectureId).get()
                    .addOnSuccessListener { lectureSnap ->
                        if (!lectureSnap.exists()) {
                            finishWithError("المحاضرة غير موجودة.")
                            return@addOnSuccessListener
                        }

                        val teacherId =
                            lectureSnap.getString("teacherId")

                        if (teacherId != uid) {
                            finishWithError(
                                "هذه المحاضرة ليست تابعة لحسابك."
                            )
                            return@addOnSuccessListener
                        }

                        roomName =
                            lectureSnap.getString("roomName").orEmpty()

                        if (roomName.isBlank()) {
                            finishWithError(
                                "غرفة LiveKit غير مجهزة لهذه المحاضرة."
                            )
                            return@addOnSuccessListener
                        }

                        lectureTitle.text =
                            lectureSnap.getString("title")
                                ?: "المحاضرة"

                        status.text =
                            "جاهز — اضغط بدء البث."
                    }
                    .addOnFailureListener {
                        finishWithError(
                            "تعذر قراءة المحاضرة: ${it.message}"
                        )
                    }
            }
            .addOnFailureListener {
                finishWithError(
                    "تعذر التحقق من حساب المدرس: ${it.message}"
                )
            }
    }

    private fun startBroadcast() {
        startButton.isEnabled = false
        status.text = "جاري الاتصال بـ LiveKit..."

        val tokenSource =
            TokenSource.fromDevelopmentTokenServer(
                TOKEN_SERVER_ID
            )

        tokenSource.fetch(
            TokenRequestOptions(roomName = roomName)
        ).onSuccess { response ->

            val livekitRoom = Room(this)

            room = livekitRoom

            try {
                livekitRoom.connect(
                    response.serverUrl,
                    response.participantToken
                )

                livekitRoom.localParticipant.setCameraEnabled(true)
                livekitRoom.localParticipant.setMicrophoneEnabled(true)

                videoTrack =
                    livekitRoom.localParticipant
                        .getTrackPublication(Track.Source.CAMERA)
                        ?.track as? LocalVideoTrack

                status.text = "🟢 متصل بـ LiveKit — البث يعمل"
                startButton.isEnabled = false
                cameraButton.isEnabled = true
                shareButton.isEnabled = true
                endButton.isEnabled = true

                db.collection("lectures")
                    .document(lectureId)
                    .update(
                        mapOf(
                            "isLive" to true,
                            "isPublished" to true,
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    )
            } catch (e: Exception) {
                startButton.isEnabled = true
                status.text = "فشل الاتصال: ${e.message}"
                room = null
            }

        }.onFailure {
            startButton.isEnabled = true
            status.text =
                "تعذر الحصول على توكن LiveKit: ${it.message}"
        }
    }

    private fun switchCamera() {
        val track = videoTrack ?: run {
            Toast.makeText(
                this,
                "ابدأ البث أولًا.",
                Toast.LENGTH_SHORT
            ).show()
            return
        }

        try {
            val position =
                if (track.options.position == CameraPosition.FRONT) {
                    CameraPosition.BACK
                } else {
                    CameraPosition.FRONT
                }

            track.switchCamera(position = position)

            status.text =
                if (position == CameraPosition.BACK)
                    "📷 الكاميرا الخلفية"
                else
                    "🤳 الكاميرا الأمامية"
        } catch (e: Exception) {
            Toast.makeText(
                this,
                "تعذر تبديل الكاميرا: ${e.message}",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun requestScreenShare() {
        val manager =
            getSystemService(
                MEDIA_PROJECTION_SERVICE
            ) as MediaProjectionManager

        val intent = manager.createScreenCaptureIntent()

        startActivityForResult(
            intent,
            SCREEN_CAPTURE_REQUEST
        )
    }

    @Deprecated("Use Activity Result API in a later cleanup pass.")
    override fun onActivityResult(
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        super.onActivityResult(
            requestCode,
            resultCode,
            data
        )

        if (requestCode != SCREEN_CAPTURE_REQUEST) {
            return
        }

        if (resultCode != Activity.RESULT_OK || data == null) {
            Toast.makeText(
                this,
                "تم إلغاء مشاركة الشاشة.",
                Toast.LENGTH_SHORT
            ).show()
            return
        }

        val currentRoom = room ?: return

        try {
            currentRoom.localParticipant
                .setScreenShareEnabled(
                    true,
                    data
                )

            screenShareActive = true
            shareButton.text = "🛑 إيقاف الشاشة"
            status.text =
                "📱 شاشة الهاتف يتم بثها الآن"
        } catch (e: Exception) {
            Toast.makeText(
                this,
                "تعذر تشغيل مشاركة الشاشة: ${e.message}",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun endBroadcast() {
        db.collection("lectures")
            .document(lectureId)
            .update(
                mapOf(
                    "isLive" to false,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            )
            .addOnCompleteListener {
                try {
                    if (screenShareActive) {
                        room?.localParticipant
                            ?.setScreenShareEnabled(false)
                    }
                } catch (_: Exception) {
                }

                room?.disconnect()
                room = null

                status.text = "تم إنهاء البث."
                cameraButton.isEnabled = false
                shareButton.isEnabled = false
                endButton.isEnabled = false
                startButton.isEnabled = true
                screenShareActive = false
            }
    }

    override fun onDestroy() {
        try {
            room?.disconnect()
        } catch (_: Exception) {
        }

        room = null
        super.onDestroy()
    }

    private fun finishWithError(message: String) {
        Toast.makeText(
            this,
            message,
            Toast.LENGTH_LONG
        ).show()
        finish()
    }
}
