package com.masaraltamreed.teacher

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast

import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue

import io.livekit.android.LiveKit
import io.livekit.android.renderer.SurfaceViewRenderer
import io.livekit.android.room.Room
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.Track
import io.livekit.android.token.TokenRequestOptions
import io.livekit.android.token.TokenSource

import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await


class MainActivity : AppCompatActivity() {

    private lateinit var auth: FirebaseAuth
    private lateinit var db: FirebaseFirestore

    private lateinit var room: Room

    private lateinit var lectureTitle: TextView
    private lateinit var statusText: TextView

    private lateinit var startButton: Button
    private lateinit var switchCameraButton: Button
    private lateinit var shareScreenButton: Button
    private lateinit var stopShareButton: Button
    private lateinit var endButton: Button

    private lateinit var localVideo: SurfaceViewRenderer

    private var lectureId: String? = null
    private var roomName: String? = null

    private var cameraTrack: LocalVideoTrack? = null

    private var isLive = false
    private var isSharingScreen = false


    private val tokenServerId =
        "masaraltamreed-5uoy7c"


    private val screenCaptureLauncher =
        registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->

            if (
                result.resultCode != Activity.RESULT_OK ||
                result.data == null
            ) {

                statusText.text =
                    "لم تتم الموافقة على مشاركة الشاشة"

                return@registerForActivityResult
            }

            val data =
                result.data!!

            lifecycleScope.launch {

                try {

                    room.localParticipant
                        .setScreenShareEnabled(
                            true,
                            data
                        )

                    isSharingScreen = true

                    shareScreenButton.isEnabled = false
                    stopShareButton.isEnabled = true

                    statusText.text =
                        "📱 شاشة الهاتف يتم بثها الآن"

                } catch (error: Exception) {

                    statusText.text =
                        "فشل تشغيل مشاركة الشاشة"

                    showError(error)
                }
            }
        }


    private val permissionsLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { permissions ->

            val cameraGranted =
                permissions[
                    Manifest.permission.CAMERA
                ] == true

            val microphoneGranted =
                permissions[
                    Manifest.permission.RECORD_AUDIO
                ] == true

            if (
                cameraGranted &&
                microphoneGranted
            ) {

                connectToLiveKit()

            } else {

                showMessage(
                    "يجب السماح بالكاميرا والميكروفون"
                )
            }
        }


    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        super.onCreate(savedInstanceState)

        setContentView(
            R.layout.activity_main
        )


        auth =
            FirebaseAuth.getInstance()

        db =
            FirebaseFirestore.getInstance()


        lectureTitle =
            findViewById(R.id.lectureTitle)

        statusText =
            findViewById(R.id.statusText)

        startButton =
            findViewById(R.id.startButton)

        switchCameraButton =
            findViewById(R.id.switchCameraButton)

        shareScreenButton =
            findViewById(R.id.shareScreenButton)

        stopShareButton =
            findViewById(R.id.stopShareButton)

        endButton =
            findViewById(R.id.endButton)

        localVideo =
            findViewById(R.id.localVideo)


        room =
            LiveKit.create(
                applicationContext
            )


        room.initVideoRenderer(
            localVideo
        )


        lectureId =
            getLectureIdFromIntent()


        if (lectureId.isNullOrBlank()) {

            lectureTitle.text =
                "لم يتم تحديد المحاضرة"

            statusText.text =
                "افتح المحاضرة من لوحة المدرس"

            startButton.isEnabled =
                false

            return
        }


        loadLecture()


        startButton.setOnClickListener {
            requestPermissionsAndConnect()
        }


        switchCameraButton.setOnClickListener {
            switchCamera()
        }


        shareScreenButton.setOnClickListener {
            requestScreenShare()
        }


        stopShareButton.setOnClickListener {
            stopScreenShare()
        }


        endButton.setOnClickListener {
            endLecture()
        }
    }


    private fun getLectureIdFromIntent(): String? {

        val directExtra =
            intent.getStringExtra(
                "lectureId"
            )

        if (!directExtra.isNullOrBlank()) {
            return directExtra
        }


        val data: Uri? =
            intent.data


        return data?.getQueryParameter(
            "lectureId"
        )
    }


    private fun loadLecture() {

        lifecycleScope.launch {

            try {

                statusText.text =
                    "جاري التحقق من المحاضرة..."


                val firebaseUser =
                    auth.currentUser
                        ?: throw Exception(
                            "يجب تسجيل الدخول أولًا"
                        )


                /*
                 * 1
                 * المستخدم الحالي
                 */

                val userSnapshot =
                    db.collection("users")
                        .document(firebaseUser.uid)
                        .get()
                        .await()


                if (!userSnapshot.exists()) {
                    throw Exception(
                        "بيانات المدرس غير موجودة"
                    )
                }


                val userData =
                    userSnapshot.data
                        ?: throw Exception(
                            "بيانات المدرس غير صالحة"
                        )


                val role =
                    userData["role"] as? String

                val active =
                    userData["isActive"]
                        as? Boolean ?: false


                if (role != "teacher") {
                    throw Exception(
                        "الحساب الحالي ليس حساب مدرس"
                    )
                }


                if (!active) {
                    throw Exception(
                        "حساب المدرس غير مفعل"
                    )
                }


                /*
                 * 2
                 * المحاضرة
                 */

                val lectureSnapshot =
                    db.collection("lectures")
                        .document(
                            lectureId!!
                        )
                        .get()
                        .await()


                if (!lectureSnapshot.exists()) {

                    throw Exception(
                        "المحاضرة غير موجودة"
                    )
                }


                val lecture =
                    lectureSnapshot.data
                        ?: throw Exception(
                            "بيانات المحاضرة غير صالحة"
                        )


                /*
                 * 3
                 * التأكد أن المحاضرة
                 * تخص المدرس الحالي
                 */

                val teacherId =
                    lecture["teacherId"]
                        as? String


                if (
                    teacherId !=
                    firebaseUser.uid
                ) {

                    throw Exception(
                        "هذه المحاضرة ليست تابعة لحسابك"
                    )
                }


                /*
                 * 4
                 * roomName
                 */

                val loadedRoomName =
                    lecture["roomName"]
                        as? String


                if (
                    loadedRoomName.isNullOrBlank()
                ) {

                    throw Exception(
                        "غرفة LiveKit غير مجهزة لهذه المحاضرة"
                    )
                }


                roomName =
                    loadedRoomName


                lectureTitle.text =
                    lecture["title"]
                        as? String
                        ?: "المحاضرة"


                statusText.text =
                    "جاهز لبدء المحاضرة"


            } catch (error: Exception) {

                startButton.isEnabled =
                    false

                showError(error)
            }
        }
    }


    private fun requestPermissionsAndConnect() {

        val needed =
            mutableListOf<String>()


        if (
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA
            ) != PackageManager.PERMISSION_GRANTED
        ) {

            needed.add(
                Manifest.permission.CAMERA
            )
        }


        if (
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO
            ) != PackageManager.PERMISSION_GRANTED
        ) {

            needed.add(
                Manifest.permission.RECORD_AUDIO
            )
        }


        if (needed.isEmpty()) {

            connectToLiveKit()

        } else {

            permissionsLauncher.launch(
                needed.toTypedArray()
            )
        }
    }


    private fun connectToLiveKit() {

        lifecycleScope.launch {

            try {

                val actualRoom =
                    roomName
                        ?: throw Exception(
                            "اسم غرفة LiveKit غير موجود"
                        )


                statusText.text =
                    "جاري الاتصال بـ LiveKit..."


                /*
                 * Development Token Server
                 */

                val tokenSource =
                    TokenSource
                        .fromDevelopmentTokenServer(
                            tokenServerId
                        )
                        .cached()


                val result =
                    tokenSource.fetch(
                        TokenRequestOptions(
                            roomName = actualRoom,
                            participantName =
                                auth.currentUser?.email
                                    ?: "Teacher",
                            participantIdentity =
                                auth.currentUser?.uid
                        )
                    )


                val credentials =
                    result.getOrElse {
                        throw Exception(
                            it.message
                                ?: "تعذر الحصول على LiveKit Token"
                        )
                    }


                room.connect(
                    credentials.serverUrl,
                    credentials.participantToken
                )


                room.localParticipant
                    .setCameraEnabled(true)


                room.localParticipant
                    .setMicrophoneEnabled(true)


                cameraTrack =
                    room.localParticipant
                        .getTrackPublication(
                            Track.Source.CAMERA
                        )
                        ?.track
                                as? LocalVideoTrack


                cameraTrack?.addRenderer(
                    localVideo
                )


                /*
                 * تحديث Firestore
                 */

                db.collection("lectures")
                    .document(lectureId!!)
                    .update(
                        mapOf(
                            "isLive" to true,
                            "isPublished" to true,
                            "updatedAt" to
                                FieldValue.serverTimestamp()
                        )
                    )
                    .await()


                isLive = true


                startButton.isEnabled =
                    false

                switchCameraButton.isEnabled =
                    true

                shareScreenButton.isEnabled =
                    true

                endButton.isEnabled =
                    true


                statusText.text =
                    "🔴 المحاضرة مباشرة الآن"


            } catch (error: Exception) {

                showError(error)
            }
        }
    }


    private fun switchCamera() {

        lifecycleScope.launch {

            try {

                val track =
                    cameraTrack
                        ?: throw Exception(
                            "الكاميرا غير متاحة"
                        )


                track.switchCamera()


                statusText.text =
                    "🔄 تم تبديل الكاميرا"


            } catch (error: Exception) {

                showError(error)
            }
        }
    }


    private fun requestScreenShare() {

        val manager =
            getSystemService(
                MEDIA_PROJECTION_SERVICE
            ) as MediaProjectionManager


        val captureIntent =
            manager.createScreenCaptureIntent()


        screenCaptureLauncher.launch(
            captureIntent
        )
    }


    private fun stopScreenShare() {

        lifecycleScope.launch {

            try {

                room.localParticipant
                    .setScreenShareEnabled(false)


                isSharingScreen = false

                shareScreenButton.isEnabled =
                    true

                stopShareButton.isEnabled =
                    false

                statusText.text =
                    "تم إيقاف مشاركة الشاشة"


            } catch (error: Exception) {

                showError(error)
            }
        }
    }


    private fun endLecture() {

        lifecycleScope.launch {

            try {

                if (isSharingScreen) {

                    room.localParticipant
                        .setScreenShareEnabled(false)

                    isSharingScreen = false
                }


                if (
                    lectureId != null
                ) {

                    db.collection("lectures")
                        .document(
                            lectureId!!
                        )
                        .update(
                            mapOf(
                                "isLive" to false,
                                "updatedAt" to
                                    FieldValue
                                        .serverTimestamp()
                            )
                        )
                        .await()
                }


                room.disconnect()


                isLive = false


                statusText.text =
                    "تم إنهاء المحاضرة"


                startButton.isEnabled =
                    true

                switchCameraButton.isEnabled =
                    false

                shareScreenButton.isEnabled =
                    false

                stopShareButton.isEnabled =
                    false

                endButton.isEnabled =
                    false


            } catch (error: Exception) {

                showError(error)
            }
        }
    }


    private fun showMessage(
        message: String
    ) {

        Toast.makeText(
            this,
            message,
            Toast.LENGTH_LONG
        ).show()
    }


    private fun showError(
        error: Throwable
    ) {

        val message =
            error.message
                ?: "حدث خطأ غير معروف"


        statusText.text =
            "❌ $message"


        Toast.makeText(
            this,
            message,
            Toast.LENGTH_LONG
        ).show()
    }


    override fun onNewIntent(
        intent: Intent
    ) {

        super.onNewIntent(intent)

        setIntent(intent)

        val newLectureId =
            getLectureIdFromIntent()


        if (
            !newLectureId.isNullOrBlank() &&
            newLectureId != lectureId
        ) {

            lectureId =
                newLectureId

            loadLecture()
        }
    }


    override fun onDestroy() {

        try {

            room.disconnect()
            room.release()

        } catch (_: Exception) {
        }


        super.onDestroy()
    }
}
