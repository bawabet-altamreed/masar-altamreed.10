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

        onLocalTrackPublished = () => {},

        onLocalTrackUnpublished = () => {},

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
   Front <-> Back
===================================================== */

export async function switchTeacherCamera(
    room,
    facingMode = "environment"
) {

    if (!room) {

        throw new Error(
            "غرفة LiveKit غير متصلة."
        );

    }


    const localParticipant =
        room.localParticipant;


    if (!localParticipant) {

        throw new Error(
            "تعذر الوصول إلى كاميرا المدرس."
        );

    }


    const publication =
        localParticipant.getTrackPublication(
            Track.Source.Camera
        );


    if (
        !publication ||
        !publication.track
    ) {

        throw new Error(
            "كاميرا المدرس غير مفعلة حاليًا."
        );

    }


    const videoTrack =
        publication.track;


    try {

        await videoTrack.restartTrack({

            facingMode

        });

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


    return videoTrack;

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
            "متصفحك لا يدعم مشاركة الشاشة. جرّب متصفحًا حديثًا يدعم مشاركة الشاشة."
        );

    }


    try {

        await room.localParticipant.setScreenShareEnabled(
            true,
            {

                audio: false,

                contentHint:
                    "detail"

            }
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


        throw new Error(
            error?.message ||
            "تعذر بدء مشاركة الشاشة."
        );

    }


    const publication =
        room.localParticipant.getTrackPublication(
            Track.Source.ScreenShare
        );


    return publication?.track || null;

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

        await room.localParticipant.setScreenShareEnabled(
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
   Is Screen Sharing
===================================================== */

export function isScreenSharing(
    room
) {

    if (!room?.localParticipant) {

        return false;

    }


    const publication =
        room.localParticipant.getTrackPublication(
            Track.Source.ScreenShare
        );


    return Boolean(
        publication?.track
    );

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


    if (
        element instanceof
        HTMLVideoElement
    ) {

        element.autoplay =
            true;

        element.playsInline =
            true;

        element.muted =
            true;

    }


    container.appendChild(
        element
    );


    return element;

}


/* =====================================================
   Attach Local Video Tracks
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
          لا نعرض Audio Track محليًا
          حتى لا يحصل Echo للمدرس.
        */

        if (
            publication.kind !==
            "video"
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
   Attach Camera Track
===================================================== */

export function attachCameraTrack(
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
        room.localParticipant.getTrackPublication(
            Track.Source.Camera
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
   Attach Screen Track
===================================================== */

export function attachScreenTrack(
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
        room.localParticipant.getTrackPublication(
            Track.Source.ScreenShare
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
