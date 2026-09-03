import {
    Room,
    RoomEvent,
    Track,
    TokenSource
} from "https://cdn.jsdelivr.net/npm/livekit-client@2.22.2/+esm";

import {
    LIVEKIT_CONFIG
} from "./config.js";


let currentRoom = null;


/* =====================================================
   Get LiveKit Token
===================================================== */

export async function getLiveKitToken(
    roomName
) {

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

        onConnectionError = () => {},

        onLocalTrackPublished = () => {},

        onLocalTrackUnpublished = () => {}

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


    room.on(
        RoomEvent.LocalTrackPublished,

        publication => {

            onLocalTrackPublished(
                publication
            );

        }

    );


    room.on(
        RoomEvent.LocalTrackUnpublished,

        publication => {

            onLocalTrackUnpublished(
                publication
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
   Switch Camera
===================================================== */

export async function switchTeacherCamera(
    room,
    facingMode
) {

    if (!room) {

        throw new Error(
            "غرفة LiveKit غير متصلة."
        );

    }


    if (!room.localParticipant) {

        throw new Error(
            "تعذر الوصول إلى كاميرا المدرس."
        );

    }


    const localParticipant =
        room.localParticipant;


    try {

        await localParticipant.setCameraEnabled(
            false
        );


        await localParticipant.setCameraEnabled(
            true,
            {
                facingMode
            }
        );

    } catch (error) {

        console.error(
            "Camera switch error:",
            error
        );


        if (
            error?.name ===
            "NotAllowedError"
        ) {

            throw new Error(
                "المتصفح لم يسمح بالوصول إلى الكاميرا."
            );

        }


        if (
            error?.name ===
            "NotFoundError"
        ) {

            throw new Error(
                "لم يتم العثور على الكاميرا المطلوبة."
            );

        }


        throw new Error(
            error?.message ||
            "تعذر تبديل الكاميرا."
        );

    }


    return localParticipant;

}


/* =====================================================
   Start Screen Share
===================================================== */

export async function startScreenShare(
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


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getDisplayMedia
    ) {

        throw new Error(
            "هذا المتصفح لا يدعم مشاركة الشاشة. جرّب متصفحًا حديثًا يدعم مشاركة الشاشة."
        );

    }


    try {

        await room
            .localParticipant
            .setScreenShareEnabled(
                true
            );

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


        if (
            error?.name ===
            "NotSupportedError"
        ) {

            throw new Error(
                "المتصفح الحالي لا يدعم مشاركة الشاشة."
            );

        }


        throw new Error(
            error?.message ||
            "تعذر بدء مشاركة الشاشة."
        );

    }


    return room.localParticipant;

}


/* =====================================================
   Stop Screen Share
===================================================== */

export async function stopScreenShare(
    room
) {

    if (!room) {

        return;

    }


    if (!room.localParticipant) {

        return;

    }


    try {

        await room
            .localParticipant
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
   Get Local Publication
===================================================== */

export function getLocalPublication(
    room,
    source
) {

    if (
        !room ||
        !room.localParticipant
    ) {

        return null;

    }


    for (
        const publication
        of room.localParticipant
            .trackPublications
            .values()
    ) {

        if (
            publication.source ===
            source
        ) {

            return publication;

        }

    }


    return null;

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
        getLocalPublication(
            room,
            Track.Source.Camera
        );


    if (
        !publication ||
        !publication.track
    ) {

        return null;

    }


    container.innerHTML =
        "";


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
        getLocalPublication(
            room,
            Track.Source.ScreenShare
        );


    if (
        !publication ||
        !publication.track
    ) {

        return null;

    }


    container.innerHTML =
        "";


    return attachTrack(
        publication.track,
        container
    );

}


/* =====================================================
   Attach Local Tracks
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
