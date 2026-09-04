package com.masaraltamreed.teacher

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast

import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope

import io.livekit.android.LiveKit
import io.livekit.android.renderer.SurfaceViewRenderer
import io.livekit.android.room.Room
import io.livekit.android.room.track.LocalVideoTrack
import io.livekit.android.room.track.Track
import io.livekit.android.token.TokenRequestOptions
import io.livekit.android.token.TokenSource

import kotlinx.coroutines.launch


class MainActivity : AppCompatActivity() {

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


    private val liveKitUrl =
        "wss://masar-al-tamreed-yao3ibc5.livekit.cloud"


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


            val permissionData =
                result.data!!


            lifecycleScope.launch {

                try {

                    room.localParticipant
                        .setScreenShareEnabled(
                            true,
                            permissionData
                        )


                    isSharingScreen = true

                    shareScreenButton.isEnabled = false
                    stopShareButton.isEnabled = true

                    statusText.text =
                        "📱 شاشة الهاتف يتم بثها الآن"

                } catch (error: Exception) {

                    statusText.text =
                        "فشل تشغيل مشاركة الشاشة"

                    Toast.makeText(
                        this@MainActivity,
                        error.message
                            ?: "خطأ غير معروف",
                        Toast.LENGTH_LONG
                    ).show()
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

                Toast.makeText(
                    this,
                    "يجب السماح بالكاميرا والميكروفون",
                    Toast.LENGTH_LONG
                ).show()
            }
        }


    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        super.onCreate(savedInstanceState)

        setContentView(
            R.layout.activity_main
        )


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


        /*
         * مؤقتًا نقرأ lectureId من Intent.
         *
         * مثال:
         *
         * teacher-app://lecture?lectureId=ABC
         */

        lectureId =
            intent.getStringExtra(
                "lectureId"
            )


        if (
            lectureId.isNullOrBlank()
        ) {

            statusText.text =
                "معرّف المحاضرة غير موجود"

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


    private fun loadLecture() {

        /*
         * هنا هنربط Firebase Firestore.
         *
         * نجيب:
         *
         * lectures/{lectureId}
         *
         * ثم:
         *
         * teacherId
         * title
         * roomName
         * isLive
         *
         * ونتأكد أن المحاضرة تخص المدرس الحالي.
         *
         * سيتم وضع كود Firebase Android
         * في الخطوة التالية بعد إضافة Firebase
         * إلى مشروع Android.
         */

        lectureTitle.text =
            "المحاضرة: $lectureId"

        statusText.text =
            "جاهز لبدء المحاضرة"
    }


    private fun requestPermissionsAndConnect() {

        val requiredPermissions =
            mutableListOf<String>()


        if (
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA
            ) != PackageManager.PERMISSION_GRANTED
        ) {

            requiredPermissions.add(
                Manifest.permission.CAMERA
            )
        }


        if (
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO
            ) != PackageManager.PERMISSION_GRANTED
        ) {

            requiredPermissions.add(
                Manifest.permission.RECORD_AUDIO
            )
        }


        if (
            requiredPermissions.isEmpty()
        ) {

            connectToLiveKit()

        } else {

            permissionsLauncher.launch(
                requiredPermissions.toTypedArray()
            )
        }
    }


    private fun connectToLiveKit() {

        lifecycleScope.launch {

            try {

                statusText.text =
                    "جاري الاتصال بـ LiveKit..."


                /*
                 * بعد جلب roomName من Firestore:
                 */

                val actualRoomName =
                    roomName


                if (
                    actualRoomName.isNullOrBlank()
                ) {

                    throw Exception(
                        "غرفة المحاضرة غير موجودة"
                    )
                }


                val tokenSource =
                    TokenSource
                        .fromDevelopmentTokenServer(
                            tokenServerId
                        )
                        .cached()


                val credentials =
                    tokenSource.fetch(
                        TokenRequestOptions(
                            roomName =
                                actualRoomName
                        )
                    ).getOrThrow()


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


                statusText.text =
                    "🟢 متصل بالمحاضرة"


                switchCameraButton.isEnabled =
                    true

                shareScreenButton.isEnabled =
                    true

                endButton.isEnabled =
                    true

                startButton.isEnabled =
                    false

                isLive = true


            } catch (error: Exception) {

                statusText.text =
                    "❌ فشل الاتصال"


                Toast.makeText(
                    this@MainActivity,
                    error.message
                        ?: "تعذر الاتصال",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }


    private fun switchCamera() {

        lifecycleScope.launch {

            try {

                val track =
                    cameraTrack

                if (track == null) {

                    Toast.makeText(
                        this@MainActivity,
                        "الكاميرا غير متاحة",
                        Toast.LENGTH_SHORT
                    ).show()

                    return@launch
                }


                track.switchCamera()


                statusText.text =
                    "🔄 تم تبديل الكاميرا"

            } catch (error: Exception) {

                Toast.makeText(
                    this@MainActivity,
                    error.message
                        ?: "تعذر تبديل الكاميرا",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }


    private fun requestScreenShare() {

        val manager =
            getSystemService(
                MEDIA_PROJECTION_SERVICE
            ) as MediaProjectionManager


        val intent =
            manager.createScreenCaptureIntent()


        screenCaptureLauncher.launch(
            intent
        )
    }


    private fun stopScreenShare() {

        lifecycleScope.launch {

            try {

                room.localParticipant
                    .setScreenShareEnabled(
                        false
                    )


                isSharingScreen = false

                shareScreenButton.isEnabled =
                    true

                stopShareButton.isEnabled =
                    false

                statusText.text =
                    "🟢 تم إيقاف مشاركة الشاشة"

            } catch (error: Exception) {

                Toast.makeText(
                    this@MainActivity,
                    error.message
                        ?: "تعذر إيقاف مشاركة الشاشة",
                    Toast.LENGTH_LONG
                ).show()
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


                /*
                 * هنا هنحدث:
                 *
                 * lectures/{lectureId}
                 *
                 * isLive = false
                 *
                 * updatedAt = ...
                 *
                 * باستخدام Firebase.
                 */


                room.disconnect()


                isLive = false


                statusText.text =
                    "تم إنهاء المحاضرة"


                switchCameraButton.isEnabled =
                    false

                shareScreenButton.isEnabled =
                    false

                stopShareButton.isEnabled =
                    false

                endButton.isEnabled =
                    false

                startButton.isEnabled =
                    true


            } catch (error: Exception) {

                Toast.makeText(
                    this@MainActivity,
                    error.message
                        ?: "تعذر إنهاء المحاضرة",
                    Toast.LENGTH_LONG
                ).show()
            }
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
