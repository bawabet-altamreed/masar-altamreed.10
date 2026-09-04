package com.masaraltamreed.teacher

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
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

    private lateinit var roomNameInput: EditText
    private lateinit var connectButton: Button
    private lateinit var screenShareButton: Button
    private lateinit var stopShareButton: Button
    private lateinit var statusText: TextView
    private lateinit var localVideo: SurfaceViewRenderer

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

            val data = result.data!!

            lifecycleScope.launch {

                try {

                    room.localParticipant
                        .setScreenShareEnabled(
                            true,
                            data
                        )

                    statusText.text =
                        "📱 شاشة الهاتف يتم بثها الآن"

                    screenShareButton.isEnabled = false
                    stopShareButton.isEnabled = true

                } catch (e: Exception) {

                    statusText.text =
                        "فشل تشغيل مشاركة الشاشة"

                    Toast.makeText(
                        this@MainActivity,
                        e.message ?: "خطأ غير معروف",
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
                permissions[Manifest.permission.CAMERA] == true

            val microphoneGranted =
                permissions[Manifest.permission.RECORD_AUDIO] == true

            if (
                cameraGranted &&
                microphoneGranted
            ) {
                connectToRoom()
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

        roomNameInput =
            findViewById(R.id.roomNameInput)

        connectButton =
            findViewById(R.id.connectButton)

        screenShareButton =
            findViewById(R.id.screenShareButton)

        stopShareButton =
            findViewById(R.id.stopShareButton)

        statusText =
            findViewById(R.id.statusText)

        localVideo =
            findViewById(R.id.localVideo)


        room =
            LiveKit.create(applicationContext)

        room.initVideoRenderer(localVideo)


        connectButton.setOnClickListener {

            requestPermissionsAndConnect()
        }


        screenShareButton.setOnClickListener {

            startScreenShare()
        }


        stopShareButton.setOnClickListener {

            stopScreenShare()
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

            connectToRoom()

        } else {

            permissionsLauncher.launch(
                needed.toTypedArray()
            )
        }
    }


    private fun connectToRoom() {

        val roomName =
            roomNameInput.text
                .toString()
                .trim()

        if (roomName.isEmpty()) {

            roomNameInput.error =
                "اكتب اسم غرفة المحاضرة"

            return
        }


        connectButton.isEnabled = false

        statusText.text =
            "جاري الاتصال بـ LiveKit..."


        lifecycleScope.launch {

            try {

                val tokenSource =
                    TokenSource
                        .fromDevelopmentTokenServer(
                            tokenServerId
                        )
                        .cached()


                val credentials =
                    tokenSource.fetch(
                        TokenRequestOptions(
                            roomName = roomName
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


                val cameraTrack =
                    room.localParticipant
                        .getTrackPublication(
                            Track.Source.CAMERA
                        )
                        ?.track as? LocalVideoTrack


                cameraTrack?.addRenderer(
                    localVideo
                )


                statusText.text =
                    "🟢 متصل بالمحاضرة"


                screenShareButton.isEnabled =
                    true


            } catch (e: Exception) {

                connectButton.isEnabled =
                    true

                statusText.text =
                    "❌ فشل الاتصال"


                Toast.makeText(
                    this@MainActivity,
                    e.message ?: "تعذر الاتصال",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }


    private fun startScreenShare() {

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

                screenShareButton.isEnabled =
                    true

                stopShareButton.isEnabled =
                    false

                statusText.text =
                    "🟢 مشاركة الشاشة متوقفة"

            } catch (e: Exception) {

                Toast.makeText(
                    this@MainActivity,
                    e.message ?: "خطأ",
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
