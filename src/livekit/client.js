import {
    Room,
    RoomEvent,
    Track,
    TokenSource
} from "https://cdn.jsdelivr.net/npm/livekit-client@2.22.2/+esm";

import { LIVEKIT_CONFIG } from "./config.js";

let currentRoom = null;


/* =====================================================
   Get LiveKit Token
===================================================== */

export async function getLiveKitToken(roomName) {

    if (!roomName) {
        throw new Error(
            "اسم غرفة المحاضرة غير موجود."
        );
    }

    if (
        !LIVEKIT_CONFIG ||
        !LIVEKIT_CONFIG.tokenServerId
    ) {
        throw new Error(
            "إعدادات LiveKit غير مكتملة."
        );
    }

    const tokenSource =
        TokenSource.developmentTokenServer(
            LIVEKIT_CONFIG.tokenServerId
        );

    const result =
        await tokenSource.fetch({
            roomName
        });

    if (
        !result ||
        !result.serverUrl ||
        !result.participantToken
    ) {
        throw new Error(
            "تعذر الحصول على بيانات الاتصال بـ LiveKit."
        );
    }

    return result;
}


/* =====================================================
   Connect Room
   لا تغيير في الاتصال القديم
===================================================== */

export async function connectLiveKit(
    roomName,
    options = {}
) {

    if (currentRoom) {

        try {

            await currentRoom.disconnect();

        } catch (error) {

            console.warn(
                "Previous LiveKit room disconnect error:",
                error
            );
        }

        currentRoom = null;
    }


    const {
        onConnected = () => {},
        onDisconnected = () => {},
        onParticipantConnected = () => {},
        onParticipantDisconnected = () => {},
        onTrackSubscribed = () => {},
        onTrackUnsubscribed = () => {},
        onConnectionError = () => {}
    } = options;


    const {
        serverUrl,
        participantToken
    } =
        await getLiveKitToken(
            roomName
        );


    const room =
        new Room({

            adaptiveStream: true,

            dynacast: true
        });


    currentRoom =
        room;


    room.on(
        RoomEvent.Connected,
        () => {

            onConnected(
                room
            );
        }
    );


    room.on(
        RoomEvent.Disconnected,
        reason => {

            onDisconnected(
                reason
            );
        }
    );


    room.on(
        RoomEvent.ParticipantConnected,
        participant => {

            onParticipantConnected(
                participant
            );
        }
    );


    room.on(
        RoomEvent.ParticipantDisconnected,
        participant => {

            onParticipantDisconnected(
                participant
            );
        }
    );


    room.on(
        RoomEvent.TrackSubscribed,
        (
            track,
            publication,
            participant
        ) => {

            onTrackSubscribed(
                track,
                publication,
                participant
            );
        }
    );


    room.on(
        RoomEvent.TrackUnsubscribed,
        (
            track,
            publication,
            participant
        ) => {

            onTrackUnsubscribed(
                track,
                publication,
                participant
            );
        }
    );


    try {

        await room.connect(
            serverUrl,
            participantToken
        );

    } catch (error) {

        currentRoom = null;

        onConnectionError(
            error
        );

        throw error;
    }


    return room;
}


/* =====================================================
   Publish Camera + Microphone
   النسخة القديمة
===================================================== */

export async function enableTeacherMedia(
    room
) {

    if (!room) {

        throw new Error(
            "غرفة LiveKit غير متصلة."
        );
    }


    if (!room.localParticipant) {

        throw new Error(
            "تعذر الوصول إلى حساب المدرس داخل LiveKit."
        );
    }


    try {

        await room
            .localParticipant
            .enableCameraAndMicrophone();

    } catch (error) {

        console.error(
            "Camera/Microphone error:",
            error
        );


        if (
            error?.name ===
            "NotAllowedError"
        ) {

            throw new Error(
                "تم رفض صلاحية الكاميرا أو الميكروفون. اسمح للمتصفح باستخدام الكاميرا والمايك ثم حاول مرة أخرى."
            );
        }


        if (
            error?.name ===
            "NotFoundError"
        ) {

            throw new Error(
                "لم يتم العثور على كاميرا أو ميكروفون متصل بالجهاز."
            );
        }


        if (
            error?.name ===
            "NotReadableError"
        ) {

            throw new Error(
                "الكاميرا أو الميكروفون مستخدم حاليًا بواسطة برنامج آخر."
            );
        }


        throw new Error(
            error?.message ||
            "تعذر تشغيل الكاميرا والميكروفون."
        );
    }


    return room.localParticipant;
}


/* =====================================================
   Attach Track
===================================================== */

export function attachTrack(
    track,
    container
) {

    if (
        !track ||
        !container
    ) {

        return null;
    }


    const element =
        track.attach();


    element.autoplay =
        true;

    element.playsInline =
        true;


    container.appendChild(
        element
    );


    return element;
}


/* =====================================================
   Attach Local Tracks
   القديمة كما هي
===================================================== */

export function attachLocalTracks(
    room,
    container
) {

    if (
        !room ||
        !container
    ) {

        return [];
    }


    const elements = [];


    for (
        const publication
        of room.localParticipant
            .trackPublications
            .values()
    ) {

        if (
            !publication.track
        ) {

            continue;
        }


        /*
         * لا نضع Screen Share داخل
         * مكان الكاميرا.
         */

        if (
            publication.source ===
            Track.Source.ScreenShare
        ) {

            continue;
        }


        const element =
            attachTrack(
                publication.track,
                container
            );


        if (element) {

            elements.push(
                element
            );
        }
    }


    return elements;
}


/* =====================================================
   Remove Track
===================================================== */

export function detachTrack(
    track
) {

    if (!track) {
        return;
    }

    track.detach();
}


/* =====================================================
   Get Camera Publication
===================================================== */

export function getLocalCameraPublication(
    room
) {

    if (
        !room ||
        !room.localParticipant
    ) {

        return null;
    }


    return room.localParticipant
        .getTrackPublication(
            Track.Source.Camera
        ) || null;
}


/* =====================================================
   Get Screen Share Publication
===================================================== */

export function getLocalScreenSharePublication(
    room
) {

    if (
        !room ||
        !room.localParticipant
    ) {

        return null;
    }


    return room.localParticipant
        .getTrackPublication(
            Track.Source.ScreenShare
        ) || null;
}


/* =====================================================
   Switch Camera
   الطريقة الصحيحة للموبايل
===================================================== */

export async function switchTeacherCamera(
    room,
    facingMode
) {

    if (
        !room ||
        !room.localParticipant
    ) {

        throw new Error(
            "غرفة LiveKit غير متصلة."
        );
    }


    if (
        facingMode !== "user" &&
        facingMode !== "environment"
    ) {

        throw new Error(
            "نوع الكاميرا غير صحيح."
        );
    }


    const publication =
        getLocalCameraPublication(
            room
        );


    if (
        !publication ||
        !publication.track
    ) {

        throw new Error(
            "كاميرا المدرس غير مفعلة."
        );
    }


    try {

        /*
         * مهم:
         * لا نطفئ الكاميرا.
         *
         * نعيد تشغيل نفس الـtrack
         * بالكاميرا المطلوبة.
         */

        await publication.track
            .restartTrack({
                facingMode
            });


        return publication.track;

    } catch (error) {

        console.error(
            "Camera switch error:",
            error
        );


        throw new Error(
            error?.message ||
            "تعذر تبديل الكاميرا. تأكد أن الجهاز يحتوي على كاميرا أمامية وخلفية."
        );
    }
}


/* =====================================================
   Start Normal Screen Share
===================================================== */

export async function startScreenShare(
    room
) {

    if (
        !room ||
        !room.localParticipant
    ) {

        throw new Error(
            "غرفة LiveKit غير متصلة."
        );
    }


    try {

        /*
         * مشاركة الشاشة التقليدية.
         *
         * ستعمل فقط إذا كان المتصفح
         * يدعم getDisplayMedia().
         */

        await room.localParticipant
            .setScreenShareEnabled(
                true,
                {
                    audio: false,

                    contentHint:
                        "detail",

                    selfBrowserSurface:
                        "exclude",

                    surfaceSwitching:
                        "include"
                }
            );


        return getLocalScreenSharePublication(
            room
        );

    } catch (error) {

        console.error(
            "Screen share error:",
            error
        );


        if (
            error?.message?.includes(
                "getDisplayMedia"
            )
        ) {

            throw new Error(
                "المتصفح الحالي لا يدعم مشاركة الشاشة. استخدم مشاركة PDF المباشرة من زر PDF."
            );
        }


        if (
            error?.name ===
            "NotAllowedError"
        ) {

            throw new Error(
                "تم إلغاء مشاركة الشاشة."
            );
        }


        throw new Error(
            error?.message ||
            "تعذر بدء مشاركة الشاشة."
        );
    }
}


/* =====================================================
   Stop Normal Screen Share
===================================================== */

export async function stopScreenShare(
    room
) {

    if (
        !room ||
        !room.localParticipant
    ) {

        return;
    }


    try {

        await room.localParticipant
            .setScreenShareEnabled(
                false
            );

    } catch (error) {

        console.warn(
            "Stop screen share error:",
            error
        );
    }
}


/* =====================================================
   Attach Local Camera
===================================================== */

export function attachLocalCamera(
    room,
    container
) {

    if (
        !room ||
        !container
    ) {

        return null;
    }


    const publication =
        getLocalCameraPublication(
            room
        );


    if (
        !publication ||
        !publication.track
    ) {

        return null;
    }


    return attachTrack(
        publication.track,
        container
    );
}


/* =====================================================
   Attach Local Screen Share
===================================================== */

export function attachLocalScreenShare(
    room,
    container
) {

    if (
        !room ||
        !container
    ) {

        return null;
    }


    const publication =
        getLocalScreenSharePublication(
            room
        );


    if (
        !publication ||
        !publication.track
    ) {

        return null;
    }


    return attachTrack(
        publication.track,
        container
    );
}


/* =====================================================
   Publish PDF Canvas
===================================================== */

export async function publishPDFCanvas(
    room,
    canvas,
    fps = 12
) {

    if (
        !room ||
        !room.localParticipant
    ) {

        throw new Error(
            "غرفة LiveKit غير متصلة."
        );
    }


    if (
        !canvas ||
        typeof canvas.captureStream !==
        "function"
    ) {

        throw new Error(
            "المتصفح لا يدعم تشغيل PDF كفيديو."
        );
    }


    const stream =
        canvas.captureStream(
            fps
        );


    const videoTrack =
        stream.getVideoTracks()[0];


    if (!videoTrack) {

        throw new Error(
            "تعذر إنشاء مسار فيديو من ملف PDF."
        );
    }


    try {

        const publication =
            await room.localParticipant
                .publishTrack(
                    videoTrack,
                    {

                        name:
                            "pdf-share",

                        source:
                            Track.Source.ScreenShare,

                        simulcast:
                            false
                    }
                );


        return {
            publication,
            videoTrack,
            stream
        };

    } catch (error) {

        videoTrack.stop();


        console.error(
            "PDF publish error:",
            error
        );


        throw new Error(
            error?.message ||
            "تعذر إرسال ملف PDF إلى LiveKit."
        );
    }
}


/* =====================================================
   Stop PDF Canvas
===================================================== */

export async function stopPDFCanvas(
    room,
    videoTrack
) {

    if (!videoTrack) {
        return;
    }


    try {

        if (
            room &&
            room.localParticipant
        ) {

            room.localParticipant
                .unpublishTrack(
                    videoTrack
                );
        }

    } catch (error) {

        console.warn(
            "PDF unpublish error:",
            error
        );
    }


    try {

        videoTrack.stop();

    } catch (error) {

        console.warn(
            "PDF video track stop error:",
            error
        );
    }
}


/* =====================================================
   Leave Room
===================================================== */

export async function leaveLiveKit() {

    if (!currentRoom) {

        return;
    }


    const room =
        currentRoom;


    currentRoom =
        null;


    try {

        await room.disconnect();

    } catch (error) {

        console.warn(
            "LiveKit disconnect error:",
            error
        );
    }
}


/* =====================================================
   Current Room
===================================================== */

export function getCurrentRoom() {

    return currentRoom;
}
