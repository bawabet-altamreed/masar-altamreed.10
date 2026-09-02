import {
    Room,
    RoomEvent,
    Track,
    TokenSource
} from "https://cdn.jsdelivr.net/npm/livekit-client@2.15.3/dist/livekit-client.esm.mjs";

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


    const tokenSource =
        TokenSource.developmentTokenServer(
            LIVEKIT_CONFIG.tokenServerId
        );


    const result =
        await tokenSource.fetch({
            roomName
        });


    return result;

}


/* =====================================================
   Connect Room
===================================================== */

export async function connectLiveKit(
    roomName,
    options = {}
) {

    const {

        onConnected = () => {},

        onDisconnected = () => {},

        onParticipantConnected = () => {},

        onParticipantDisconnected = () => {},

        onTrackSubscribed = () => {},

        onTrackUnsubscribed = () => {}

    } = options;


    const {

        serverUrl,
        participantToken

    } = await getLiveKitToken(
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


    await room.connect(
        serverUrl,
        participantToken
    );


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


    await room.localParticipant.enableCameraAndMicrophone();


    return room.localParticipant;

}


/* =====================================================
   Attach Track To Element
===================================================== */

export function attachTrack(
    track,
    container
) {

    if (!track || !container) {
        return null;
    }


    const element =
        track.attach();


    container.appendChild(
        element
    );


    return element;

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


    try {

        await currentRoom.disconnect();

    } finally {

        currentRoom =
            null;

    }

}


/* =====================================================
   Current Room
===================================================== */

export function getCurrentRoom() {

    return currentRoom;

}
