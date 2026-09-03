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
   لا يتم تغيير اتصال LiveKit القديم
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
    } = await getLiveKitToken(
        roomName
    );


    const room =
        new Room({

            adaptiveStream:
                true,

            dynacast:
                true
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

        currentRoom =
            null;

        onConnectionError(
            error
        );

        throw error;
    }


    return room;
}


/* =====================================================
   Publish Camera + Microphone
   القديم كما هو
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
   Attach Track To Element
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
   القديم كما هو
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
   NEW — Get Camera Track
===================================================== */

export function getLocalCameraTrack(
    room
) {

    if (
        !room ||
        !room.localParticipant
    ) {

        return null;
    }


    const publication =
        room.localParticipant
            .getTrackPublication(
                Track.Source.Camera
            );


    if (
        !publication ||
        !publication.track
    ) {

        return null;
    }


    return publication.track;
}


/* =====================================================
   NEW — Switch Camera
   Front = user
   Back  = environment
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


    const videoTrack =
        getLocalCameraTrack(
            room
        );


    if (!videoTrack) {

        throw new Error(
            "تعذر الوصول إلى كاميرا المدرس."
        );
    }


    try {

        /*
         * مهم:
         * لا نطفئ الكاميرا ولا ننشئ Track جديد.
         *
         * نعيد تشغيل نفس LocalVideoTrack
         * باستخدام الكاميرا المطلوبة.
         */

        await videoTrack.restartTrack({
            facingMode
        });


        return videoTrack;

    } catch (error) {

        console.error(
            "Camera switch error:",
            error
        );


        throw new Error(
            error?.message ||
            "تعذر تبديل الكاميرا."
        );
    }
}


/* =====================================================
   NEW — Start Screen Share
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


    /*
     * getDisplayMedia هو ما يستخدمه LiveKit
     * في المتصفح لالتقاط الشاشة.
     */

    if (
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices
            .getDisplayMedia !== "function"
    ) {

        throw new Error(
            "مشاركة الشاشة غير مدعومة في هذا المتصفح. جرّب فتح الموقع من متصفح يدعم مشاركة الشاشة."
        );
    }


    try {

        const publication =
            await room.localParticipant
                .setScreenShareEnabled(
                    true,
                    {
                        contentHint:
                            "detail"
                    }
                );


        return publication || null;

    } catch (error) {

        console.error(
            "Screen share error:",
            error
        );


        if (
            error?.name ===
            "NotAllowedError"
        ) {

            throw new Error(
                "تم إلغاء مشاركة الشاشة أو رفض صلاحيتها."
            );
        }


        throw new Error(
            error?.message ||
            "تعذر بدء مشاركة الشاشة."
        );
    }
}


/* =====================================================
   NEW — Stop Screen Share
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
   NEW — Get Screen Share Track
===================================================== */

export function getLocalScreenShareTrack(
    room
) {

    if (
        !room ||
        !room.localParticipant
    ) {

        return null;
    }


    const publication =
        room.localParticipant
            .getTrackPublication(
                Track.Source.ScreenShare
            );


    if (
        !publication ||
        !publication.track
    ) {

        return null;
    }


    return publication.track;
}


/* =====================================================
   NEW — Attach Screen Share
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


    const track =
        getLocalScreenShareTrack(
            room
        );


    if (!track) {

        return null;
    }


    return attachTrack(
        track,
        container
    );
}


/* =====================================================
   Leave Room
   القديم كما هو
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

