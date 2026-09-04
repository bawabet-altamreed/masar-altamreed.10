package com.masaraltamreed.teacher

import android.app.Application
import io.livekit.android.LiveKit

class TeacherApp : Application() {
    override fun onCreate() {
        super.onCreate()
        LiveKit.init(this)
    }
}
