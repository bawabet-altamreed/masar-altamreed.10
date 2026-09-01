import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import {
    AccessToken,
    RoomServiceClient,
    EgressClient,
    EncodedFileOutput,
    EncodedFileType,
    WebhookReceiver
} from "livekit-server-sdk";


/* =========================================================
   Environment
========================================================= */

dotenv.config();


const app = express();


const PORT =
    Number(process.env.PORT) || 3000;


const LIVEKIT_URL =
    process.env.LIVEKIT_URL;


const LIVEKIT_API_KEY =
    process.env.LIVEKIT_API_KEY;


const LIVEKIT_API_SECRET =
    process.env.LIVEKIT_API_SECRET;


if (
    !LIVEKIT_URL ||
    !LIVEKIT_API_KEY ||
    !LIVEKIT_API_SECRET
) {

    console.error(
        "Missing LIVEKIT_URL, LIVEKIT_API_KEY or LIVEKIT_API_SECRET."
    );

    process.exit(1);
}


/* =========================================================
   CORS
========================================================= */

app.use(
    cors()
);


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
   Prototype Storage
=========================================================

   مؤقت فقط.

   لاحقًا:
   Firestore
   +
   Firebase Storage
========================================================= */

const recordings = [];


/* =========================================================
   Normal JSON Parser
=========================================================

   مهم:
   لا نضع express.json() على الـWebhook.

   LiveKit Webhook يحتاج raw body.
========================================================= */

app.use(
    express.json()
);


/* =========================================================
   Health
========================================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            ok: true,
            service: "live-class-prototype",
            livekit: LIVEKIT_URL
        });

    }
);


/* =========================================================
   CREATE ROOM
========================================================= */

app.post(
    "/api/create-room",
    async (req, res) => {

        try {

            const teacherName =
                String(
                    req.body.teacherName ||
                    "Teacher"
                ).trim();


            const title =
                String(
                    req.body.title ||
                    "Live Class"
                ).trim();


            /* -------------------------------------------------
               Unique Room Name
            ------------------------------------------------- */

            const roomName =
                "class-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .slice(2, 8);


            /* -------------------------------------------------
               Create LiveKit Room
            ------------------------------------------------- */

            const room =
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


            /* -------------------------------------------------
               Teacher Token
            ------------------------------------------------- */

            const teacherIdentity =
                "teacher-" +
                Date.now();


            const teacherToken =
                new AccessToken(
                    LIVEKIT_API_KEY,
                    LIVEKIT_API_SECRET,
                    {

                        identity:
                            teacherIdentity,

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

                /*
                 * مهم جدًا للـEgress API
                 */
                roomRecord:
                    true

            });


            const token =
                await teacherToken.toJwt();


            /* -------------------------------------------------
               Start Automatic Recording
            -------------------------------------------------

               Room Composite
               ↓
               MP4

               LiveKit v2:
               startRoomCompositeEgress(
                   roomName,
                   output,
                   options
               )
            ------------------------------------------------- */

            const fileOutput =
                new EncodedFileOutput({

                    fileType:
                        EncodedFileType.MP4,

                    filepath:
                        `/out/${roomName}.mp4`

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


            /* -------------------------------------------------
               Save Recording Info
            ------------------------------------------------- */

            const recording = {

                roomName,

                title,

                teacherName,

                teacherIdentity,

                egressId:
                    egress.egressId,

                status:
                    "starting",

                filepath:
                    `/out/${roomName}.mp4`,

                createdAt:
                    new Date()
                        .toISOString(),

                endedAt:
                    null,

                fileResults:
                    []

            };


            recordings.push(
                recording
            );


            /* -------------------------------------------------
               Response
            ------------------------------------------------- */

            res.json({

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
                    LIVEKIT_URL,

                recording: {

                    started:
                        true,

                    egressId:
                        egress.egressId,

                    filepath:
                        recording.filepath

                }

            });

        } catch (error) {

            console.error(
                "Create room error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                error:
                    error?.message ||
                    "Failed to create room"

            });

        }

    }
);


/* =========================================================
   JOIN ROOM
========================================================= */

app.post(
    "/api/join-room",
    async (req, res) => {

        try {

            const roomName =
                String(
                    req.body.roomName ||
                    ""
                ).trim();


            const participantName =
                String(
                    req.body.participantName ||
                    "Student"
                ).trim();


            if (!roomName) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "roomName is required"

                });

            }


            /* -------------------------------------------------
               Student Identity
            ------------------------------------------------- */

            const studentIdentity =
                "student-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .slice(2, 8);


            /* -------------------------------------------------
               Student Token
            ------------------------------------------------- */

            const token =
                new AccessToken(
                    LIVEKIT_API_KEY,
                    LIVEKIT_API_SECRET,
                    {

                        identity:
                            studentIdentity,

                        name:
                            participantName

                    }
                );


            token.addGrant({

                roomJoin:
                    true,

                room:
                    roomName,

                canPublish:
                    true,

                canSubscribe:
                    true,

                canPublishData:
                    true

            });


            const jwt =
                await token.toJwt();


            res.json({

                success:
                    true,

                token:
                    jwt,

                livekitUrl:
                    LIVEKIT_URL,

                roomName,

                identity:
                    studentIdentity

            });

        } catch (error) {

            console.error(
                "Join room error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                error:
                    error?.message ||
                    "Failed to join room"

            });

        }

    }
);


/* =========================================================
   STOP RECORDING
=========================================================

   المدرس يقدر ينهي التسجيل صراحة.

   POST /api/stop-recording

   {
       "egressId": "EG_..."
   }
========================================================= */

app.post(
    "/api/stop-recording",
    async (req, res) => {

        try {

            const egressId =
                String(
                    req.body.egressId ||
                    ""
                ).trim();


            if (!egressId) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "egressId is required"

                });

            }


            const recording =
                recordings.find(
                    item =>
                        item.egressId ===
                        egressId
                );


            if (!recording) {

                return res.status(404).json({

                    success:
                        false,

                    error:
                        "Recording not found"

                });

            }


            if (
                recording.status ===
                "completed"
            ) {

                return res.json({

                    success:
                        true,

                    alreadyCompleted:
                        true

                });

            }


            const egress =
                await egressClient
                    .stopEgress(
                        egressId
                    );


            recording.status =
                "stopping";


            recording.stopRequestedAt =
                new Date()
                    .toISOString();


            res.json({

                success:
                    true,

                egressId,

                status:
                    egress.status

            });

        } catch (error) {

            console.error(
                "Stop recording error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                error:
                    error?.message ||
                    "Failed to stop recording"

            });

        }

    }
);


/* =========================================================
   RECORDINGS
========================================================= */

app.get(
    "/api/recordings",
    (req, res) => {

        res.json({

            success:
                true,

            recordings:
                recordings.map(
                    recording => ({

                        roomName:
                            recording.roomName,

                        title:
                            recording.title,

                        teacherName:
                            recording.teacherName,

                        egressId:
                            recording.egressId,

                        status:
                            recording.status,

                        filepath:
                            recording.filepath,

                        createdAt:
                            recording.createdAt,

                        endedAt:
                            recording.endedAt,

                        fileResults:
                            recording.fileResults

                    })
                )

        });

    }
);


/* =========================================================
   SINGLE RECORDING
========================================================= */

app.get(
    "/api/recordings/:egressId",
    (req, res) => {

        const recording =
            recordings.find(
                item =>
                    item.egressId ===
                    req.params.egressId
            );


        if (!recording) {

            return res.status(404).json({

                success:
                    false,

                error:
                    "Recording not found"

            });

        }


        res.json({

            success:
                true,

            recording

        });

    }
);


/* =========================================================
   LIVEKIT WEBHOOK
=========================================================

   مهم جدًا:

   LiveKit يرسل:
   Content-Type:
   application/webhook+json

   ويجب تمرير RAW BODY إلى:
   webhookReceiver.receive()
========================================================= */

app.post(
    "/api/livekit/webhook",

    express.raw({
        type:
            "application/webhook+json"
    }),

    async (req, res) => {

        try {

            const authHeader =
                req.get(
                    "Authorization"
                );


            /* -------------------------------------------------
               Raw Body
            ------------------------------------------------- */

            const rawBody =
                Buffer.isBuffer(
                    req.body
                )
                    ? req.body.toString(
                        "utf8"
                    )
                    : String(
                        req.body || ""
                    );


            if (!rawBody) {

                return res.status(400).json({

                    received:
                        false,

                    error:
                        "Empty webhook body"

                });

            }


            /* -------------------------------------------------
               Verify + Decode
            ------------------------------------------------- */

            const event =
                await webhookReceiver.receive(
                    rawBody,
                    authHeader
                );


            console.log(
                "LiveKit webhook:",
                event.event
            );


            /* =================================================
               EGRESS STARTED
            ================================================= */

            if (
                event.event ===
                "egress_started"
            ) {

                const egressInfo =
                    event.egressInfo;


                if (egressInfo) {

                    const index =
                        recordings.findIndex(
                            recording =>
                                recording.egressId ===
                                egressInfo.egressId
                        );


                    if (
                        index !==
                        -1
                    ) {

                        recordings[index] = {

                            ...recordings[index],

                            status:
                                "recording"

                        };

                    }

                }

            }


            /* =================================================
               EGRESS UPDATED
            ================================================= */

            if (
                event.event ===
                "egress_updated"
            ) {

                const egressInfo =
                    event.egressInfo;


                if (egressInfo) {

                    const index =
                        recordings.findIndex(
                            recording =>
                                recording.egressId ===
                                egressInfo.egressId
                        );


                    if (
                        index !==
                        -1
                    ) {

                        recordings[index] = {

                            ...recordings[index],

                            lastUpdate:
                                new Date()
                                    .toISOString()

                        };

                    }

                }

            }


            /* =================================================
               EGRESS ENDED
            ================================================= */

            if (
                event.event ===
                "egress_ended"
            ) {

                const egressInfo =
                    event.egressInfo;


                if (egressInfo) {

                    const index =
                        recordings.findIndex(
                            recording =>
                                recording.egressId ===
                                egressInfo.egressId
                        );


                    if (
                        index !==
                        -1
                    ) {

                        const previous =
                            recordings[index];


                        recordings[index] = {

                            ...previous,

                            status:
                                "completed",

                            endedAt:
                                new Date()
                                    .toISOString(),

                            fileResults:
                                egressInfo.fileResults ||
                                []

                        };


                        console.log(
                            "======================================"
                        );


                        console.log(
                            "Recording completed"
                        );


                        console.log(
                            "Room:",
                            previous.roomName
                        );


                        console.log(
                            "File:",
                            previous.filepath
                        );


                        console.log(
                            "======================================"
                        );

                    }

                }

            }


            /* =================================================
               ROOM FINISHED
            ================================================= */

            if (
                event.event ===
                "room_finished"
            ) {

                console.log(
                    "Room finished:",
                    event.room
                );

            }


            /* -------------------------------------------------
               Always acknowledge webhook
            ------------------------------------------------- */

            res.status(200).json({

                received:
                    true

            });

        } catch (error) {

            console.error(
                "LiveKit webhook error:",
                error
            );


            res.status(401).json({

                received:
                    false,

                error:
                    "Invalid LiveKit webhook"

            });

        }

    }
);


/* =========================================================
   404
========================================================= */

app.use(
    (req, res) => {

        res.status(404).json({

            success:
                false,

            error:
                "Route not found"

        });

    }
);


/* =========================================================
   Global Error Handler
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "Server error:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        res.status(500).json({

            success:
                false,

            error:
                "Internal server error"

        });

    }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            "======================================"
        );

        console.log(
            "LIVE CLASS PROTOTYPE"
        );

        console.log(
            "======================================"
        );

        console.log(
            `Server: http://localhost:${PORT}`
        );

        console.log(
            `LiveKit: ${LIVEKIT_URL}`
        );

        console.log(
            `Health: http://localhost:${PORT}/api/health`
        );

        console.log(
            `Webhook: http://localhost:${PORT}/api/livekit/webhook`
        );

        console.log(
            "======================================"
        );

    }
);
