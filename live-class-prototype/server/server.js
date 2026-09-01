import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    AccessToken,
    RoomServiceClient,
    EgressClient,
    EncodedFileOutput,
    EncodedFileType,
    WebhookReceiver
} from "livekit-server-sdk";


dotenv.config();


/* =========================================================
   Paths
========================================================= */

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const projectRoot =
    path.resolve(__dirname, "..");

const recordingsDir =
    path.join(
        projectRoot,
        "recordings"
    );


fs.mkdirSync(
    recordingsDir,
    {
        recursive: true
    }
);


/* =========================================================
   App
========================================================= */

const app =
    express();

app.use(
    cors()
);


/*
 * LiveKit webhook content-type:
 *
 * application/webhook+json
 *
 * لذلك لازم Express يقبله.
 */
app.use(
    express.json({
        type: [
            "application/json",
            "application/webhook+json"
        ]
    })
);


/* =========================================================
   Config
========================================================= */

const PORT =
    Number(
        process.env.PORT || 3000
    );

const LIVEKIT_URL =
    process.env.LIVEKIT_URL;

const LIVEKIT_WS_URL =
    process.env.LIVEKIT_WS_URL;

const LIVEKIT_API_KEY =
    process.env.LIVEKIT_API_KEY;

const LIVEKIT_API_SECRET =
    process.env.LIVEKIT_API_SECRET;


if (
    !LIVEKIT_URL ||
    !LIVEKIT_WS_URL ||
    !LIVEKIT_API_KEY ||
    !LIVEKIT_API_SECRET
) {

    console.error(
        "Missing LiveKit environment variables."
    );

    process.exit(1);
}


/* =========================================================
   LiveKit Clients
========================================================= */

const roomService =
    new RoomServiceClient(
        LIVEKIT_URL,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
    );


const egressClient =
    new EgressClient(
        LIVEKIT_URL,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
    );


const webhookReceiver =
    new WebhookReceiver(
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
    );


/* =========================================================
   In-memory Prototype State
========================================================= */

const rooms =
    new Map();

const recordings =
    new Map();


/* =========================================================
   Helpers
========================================================= */

function safeFilename(
    value
) {

    return String(value)
        .replace(
            /[^a-zA-Z0-9._-]/g,
            "-"
        );

}


function listRecordingFiles() {

    if (
        !fs.existsSync(
            recordingsDir
        )
    ) {

        return [];

    }


    return fs
        .readdirSync(
            recordingsDir
        )
        .filter(
            file =>
                file
                    .toLowerCase()
                    .endsWith(".mp4")
        )
        .map(
            file => {

                const fullPath =
                    path.join(
                        recordingsDir,
                        file
                    );

                const stat =
                    fs.statSync(
                        fullPath
                    );

                return {

                    filename:
                        file,

                    url:
                        `/recordings/${encodeURIComponent(file)}`,

                    size:
                        stat.size,

                    createdAt:
                        stat.birthtime.toISOString()

                };

            }
        )
        .sort(
            (
                a,
                b
            ) =>
                new Date(
                    b.createdAt
                ) -
                new Date(
                    a.createdAt
                )
        );

}


/* =========================================================
   Static Frontend
========================================================= */

app.use(
    "/",
    express.static(
        path.join(
            projectRoot,
            "frontend"
        )
    )
);


app.use(
    "/recordings",
    express.static(
        recordingsDir,
        {
            setHeaders(
                response
            ) {

                response.setHeader(
                    "Content-Disposition",
                    "inline"
                );

                response.setHeader(
                    "Accept-Ranges",
                    "bytes"
                );

            }
        }
    )
);


/* =========================================================
   Health
========================================================= */

app.get(
    "/api/health",
    (
        request,
        response
    ) => {

        response.json({

            ok:
                true,

            service:
                "live-class-prototype",

            livekit:
                LIVEKIT_URL,

            recordings:
                listRecordingFiles().length

        });

    }
);


/* =========================================================
   Create Room
========================================================= */

app.post(
    "/api/create-room",
    async (
        request,
        response
    ) => {

        try {

            const teacherName =
                String(
                    request.body.teacherName ||
                    "Teacher"
                ).trim();


            const title =
                String(
                    request.body.title ||
                    "Live Class"
                ).trim();


            const roomName =
                "class-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .slice(
                        2,
                        8
                    );


            /*
             * Create LiveKit room.
             */

            await roomService.createRoom({

                name:
                    roomName,

                emptyTimeout:
                    60,

                departureTimeout:
                    20,

                maxParticipants:
                    500,

                metadata:
                    JSON.stringify({

                        title,

                        teacherName,

                        createdAt:
                            new Date()
                                .toISOString()

                    })

            });


            /*
             * Teacher token.
             */

            const teacherToken =
                new AccessToken(
                    LIVEKIT_API_KEY,
                    LIVEKIT_API_SECRET,
                    {

                        identity:
                            "teacher-" +
                            Date.now(),

                        name:
                            teacherName

                    }
                );


            teacherToken.addGrant({

                roomJoin:
                    true,

                room:
                    roomName,

                canPublish:
                    true,

                canSubscribe:
                    true,

                canPublishData:
                    true,

                roomRecord:
                    true

            });


            const token =
                await teacherToken.toJwt();


            /*
             * Start RoomComposite Egress.
             *
             * LiveKit RoomComposite is tied
             * to the room lifecycle.
             *
             * When participants leave,
             * the recording stops.
             */

            const outputPath =
                `/out/${safeFilename(
                    roomName
                )}.mp4`;


            const fileOutput =
                new EncodedFileOutput({

                    fileType:
                        EncodedFileType.MP4,

                    filepath:
                        outputPath

                });


            const egress =
                await egressClient
                    .startRoomCompositeEgress(
                        roomName,
                        fileOutput,
                        {

                            layout:
                                "speaker",

                            audioOnly:
                                false,

                            videoOnly:
                                false

                        }
                    );


            const recording = {

                roomName,

                title,

                teacherName,

                egressId:
                    egress.egressId,

                status:
                    "starting",

                filename:
                    `${safeFilename(
                        roomName
                    )}.mp4`,

                createdAt:
                    new Date()
                        .toISOString()

            };


            recordings.set(
                egress.egressId,
                recording
            );


            rooms.set(
                roomName,
                {

                    roomName,

                    title,

                    teacherName,

                    createdAt:
                        new Date()
                            .toISOString(),

                    egressId:
                        egress.egressId

                }
            );


            response.json({

                success:
                    true,

                room: {

                    name:
                        roomName,

                    title,

                    teacherName

                },

                token,

                livekitUrl:
                    LIVEKIT_WS_URL,

                recording: {

                    egressId:
                        egress.egressId,

                    filename:
                        recording.filename,

                    status:
                        recording.status

                }

            });


        } catch (error) {

            console.error(
                "Create room error:",
                error
            );


            response.status(
                500
            ).json({

                success:
                    false,

                error:
                    error.message ||
                    "Failed to create room"

            });

        }

    }
);


/* =========================================================
   Join Room
========================================================= */

app.post(
    "/api/join-room",
    async (
        request,
        response
    ) => {

        try {

            const roomName =
                String(
                    request.body.roomName ||
                    ""
                ).trim();


            const participantName =
                String(
                    request.body.participantName ||
                    "Student"
                ).trim();


            if (!roomName) {

                return response
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "roomName is required"

                    });

            }


            /*
             * Verify room exists.
             */

            const roomList =
                await roomService
                    .listRooms(
                        [roomName]
                    );


            if (
                !roomList.length
            ) {

                return response
                    .status(404)
                    .json({

                        success:
                            false,

                        error:
                            "Room not found"

                    });

            }


            const identity =
                "student-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .slice(
                        2,
                        8
                    );


            const token =
                new AccessToken(
                    LIVEKIT_API_KEY,
                    LIVEKIT_API_SECRET,
                    {

                        identity,

                        name:
                            participantName

                    }
                );


            token.addGrant({

                roomJoin:
                    true,

                room:
                    roomName,

                /*
                 * الطالب في الـPrototype
                 * يقدر يفتح كاميرا ومايك.
                 */

                canPublish:
                    true,

                canSubscribe:
                    true,

                canPublishData:
                    true

            });


            const jwt =
                await token.toJwt();


            response.json({

                success:
                    true,

                token:
                    jwt,

                livekitUrl:
                    LIVEKIT_WS_URL,

                identity

            });


        } catch (error) {

            console.error(
                "Join room error:",
                error
            );


            response.status(
                500
            ).json({

                success:
                    false,

                error:
                    error.message ||
                    "Failed to join room"

            });

        }

    }
);


/* =========================================================
   End Room
========================================================= */

app.post(
    "/api/end-room",
    async (
        request,
        response
    ) => {

        try {

            const roomName =
                String(
                    request.body.roomName ||
                    ""
                ).trim();


            if (!roomName) {

                return response
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "roomName is required"

                    });

            }


            /*
             * Remove all participants.
             *
             * RoomComposite Egress will then
             * finish with the room lifecycle.
             */

            const participants =
                await roomService
                    .listParticipants(
                        roomName
                    );


            for (
                const participant
                of participants
            ) {

                await roomService
                    .removeParticipant(
                        roomName,
                        participant.identity
                    );

            }


            response.json({

                success:
                    true,

                roomName,

                removed:
                    participants.length

            });


        } catch (error) {

            console.error(
                "End room error:",
                error
            );


            response.status(
                500
            ).json({

                success:
                    false,

                error:
                    error.message ||
                    "Failed to end room"

            });

        }

    }
);


/* =========================================================
   Recordings API
========================================================= */

app.get(
    "/api/recordings",
    (
        request,
        response
    ) => {

        response.json({

            success:
                true,

            recordings:
                listRecordingFiles()

        });

    }
);


/* =========================================================
   Recording Status
========================================================= */

app.get(
    "/api/recordings/status",
    (
        request,
        response
    ) => {

        response.json({

            success:
                true,

            active:
                Array.from(
                    recordings.values()
                )

        });

    }
);


/* =========================================================
   LiveKit Webhook
========================================================= */

app.post(
    "/api/livekit/webhook",
    async (
        request,
        response
    ) => {

        try {

            const authorization =
                request.get(
                    "Authorization"
                );


            const event =
                await webhookReceiver
                    .receive(
                        request.body,
                        authorization
                    );


            console.log(
                "LiveKit webhook:",
                event.event
            );


            /*
             * Egress started
             */

            if (
                event.event ===
                "egress_started"
            ) {

                const info =
                    event.egressInfo;


                if (info) {

                    const existing =
                        recordings.get(
                            info.egressId
                        );


                    if (existing) {

                        recordings.set(

                            info.egressId,

                            {

                                ...existing,

                                status:
                                    "recording",

                                startedAt:
                                    new Date()
                                        .toISOString()

                            }

                        );

                    }

                }

            }


            /*
             * Egress ended
             */

            if (
                event.event ===
                "egress_ended"
            ) {

                const info =
                    event.egressInfo;


                if (info) {

                    const existing =
                        recordings.get(
                            info.egressId
                        );


                    if (existing) {

                        const fileResults =
                            info.fileResults ||
                            [];


                        const firstFile =
                            fileResults[0];


                        recordings.set(

                            info.egressId,

                            {

                                ...existing,

                                status:
                                    "completed",

                                endedAt:
                                    new Date()
                                        .toISOString(),

                                fileResults,

                                filename:
                                    firstFile?.filename ||
                                    existing.filename

                            }

                        );


                        console.log(
                            "Recording completed:",
                            existing.roomName
                        );

                    }

                }

            }


            response
                .status(200)
                .json({

                    received:
                        true

                });


        } catch (error) {

            console.error(
                "LiveKit webhook error:",
                error
            );


            response
                .status(401)
                .json({

                    received:
                        false,

                    error:
                        "Invalid LiveKit webhook"

                });

        }

    }
);


/* =========================================================
   Start
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            "======================================"
        );

        console.log(
            `Live Class Prototype: http://localhost:${PORT}`
        );

        console.log(
            `LiveKit: ${LIVEKIT_WS_URL}`
        );

        console.log(
            `Recordings: ${recordingsDir}`
        );

        console.log(
            "Webhook: /api/livekit/webhook"
        );

        console.log(
            "======================================"
        );

    }
);
