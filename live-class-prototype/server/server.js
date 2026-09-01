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


dotenv.config();


const app = express();

app.use(cors());

app.use(express.json());


const PORT =
    process.env.PORT || 3000;


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
        "Missing LiveKit environment variables."
    );

    process.exit(1);

}


/*
|--------------------------------------------------------------------------
| LiveKit Clients
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| Webhook Receiver
|--------------------------------------------------------------------------
*/

const webhookReceiver =
    new WebhookReceiver(
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
    );


/*
|--------------------------------------------------------------------------
| In-memory recordings
|--------------------------------------------------------------------------
|
| مؤقت للـPrototype فقط.
|
| لاحقًا نستبدله بـFirestore.
|
|--------------------------------------------------------------------------
*/

const recordings = [];


/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            ok: true,

            service:
                "live-class-prototype"

        });

    }
);


/*
|--------------------------------------------------------------------------
| Create Room
|--------------------------------------------------------------------------
|
| المدرس:
|
| POST /api/create-room
|
| {
|   "teacherName": "Dr.Nurhan",
|   "title": "محاضرة تجريبية"
| }
|
|--------------------------------------------------------------------------
*/

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


            /*
             * Room name آمن وفريد
             */

            const roomName =
                "class-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .slice(2, 8);


            /*
             * إنشاء الغرفة
             */

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


            /*
             |--------------------------------------------------------------------------
             | Token للمدرس
             |--------------------------------------------------------------------------
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
                    true

            });


            const token =
                await teacherToken.toJwt();


            /*
             |--------------------------------------------------------------------------
             | بدء التسجيل
             |--------------------------------------------------------------------------
             |
             | التسجيل هنا يبدأ بعد إنشاء الغرفة.
             |
             | MP4
             | ↓
             | recordings/
             |
             |--------------------------------------------------------------------------
             */

            const fileOutput =
                new EncodedFileOutput({

                    fileType:
                        EncodedFileType.MP4,

                    filepath:
                        `recordings/${roomName}.mp4`

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


            /*
             * حفظ معلومات التسجيل مؤقتًا
             */

            recordings.push({

                roomName,

                title,

                teacherName,

                egressId:
                    egress.egressId,

                status:
                    "active",

                filepath:
                    `recordings/${roomName}.mp4`,

                createdAt:
                    new Date()
                        .toISOString()

            });


            /*
             |--------------------------------------------------------------------------
             | Response
             |--------------------------------------------------------------------------
             */

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
                        `recordings/${roomName}.mp4`

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
                    error.message ||
                    "Failed to create room"

            });

        }

    }
);


/*
|--------------------------------------------------------------------------
| Join Room
|--------------------------------------------------------------------------
|
| الطالب يدخل الغرفة باستخدام roomName.
|
|--------------------------------------------------------------------------
*/

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


            /*
             * Token الطالب
             */

            const token =
                new AccessToken(
                    LIVEKIT_API_KEY,
                    LIVEKIT_API_SECRET,
                    {

                        identity:
                            "student-" +
                            Date.now() +
                            "-" +
                            Math.random()
                                .toString(36)
                                .slice(2, 7),

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
                    LIVEKIT_URL

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
                    error.message ||
                    "Failed to join room"

            });

        }

    }
);


/*
|--------------------------------------------------------------------------
| Recordings
|--------------------------------------------------------------------------
|
| صفحة recordings.html تستطيع استدعاء:
|
| GET /api/recordings
|
|--------------------------------------------------------------------------
*/

app.get(
    "/api/recordings",
    (req, res) => {

        res.json({

            success:
                true,

            recordings

        });

    }
);


/*
|--------------------------------------------------------------------------
| LiveKit Webhook
|--------------------------------------------------------------------------
|
| LiveKit يرسل لنا:
|
| egress_started
| egress_updated
| egress_ended
|
|--------------------------------------------------------------------------
*/

app.post(
    "/api/livekit/webhook",
    async (req, res) => {

        try {

            const authHeader =
                req.get(
                    "Authorization"
                );


            /*
             * التحقق من أن الـWebhook
             * صادر من LiveKit.
             */

            const event =
                await webhookReceiver.receive(
                    req.body,
                    authHeader
                );


            console.log(
                "LiveKit webhook:",
                event.event
            );


            /*
             |--------------------------------------------------------------------------
             | Egress Started
             |--------------------------------------------------------------------------
             */

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


                    if (index !== -1) {

                        recordings[index] = {

                            ...recordings[index],

                            status:
                                "recording"

                        };

                    }

                }

            }


            /*
             |--------------------------------------------------------------------------
             | Egress Ended
             |--------------------------------------------------------------------------
             |
             | هنا التسجيل خلص.
             |
             | LiveKit يكون أنهى كتابة MP4.
             |
             |--------------------------------------------------------------------------
             */

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


                    if (index !== -1) {

                        recordings[index] = {

                            ...recordings[index],

                            status:
                                "completed",

                            endedAt:
                                new Date()
                                    .toISOString(),

                            fileResults:
                                egressInfo
                                    .fileResults ||
                                []

                        };

                        console.log(
                            "Recording completed:",
                            recordings[index]
                        );

                    }

                }

            }


            /*
             |--------------------------------------------------------------------------
             | Egress Updated
             |--------------------------------------------------------------------------
             */

            if (
                event.event ===
                "egress_updated"
            ) {

                console.log(
                    "Recording updated."
                );

            }


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


/*
|--------------------------------------------------------------------------
| Start
|--------------------------------------------------------------------------
*/

app.listen(
    PORT,
    () => {

        console.log(
            "======================================"
        );

        console.log(
            `Live Class Prototype running on port ${PORT}`
        );

        console.log(
            `LiveKit: ${LIVEKIT_URL}`
        );

        console.log(
            "Webhook: /api/livekit/webhook"
        );

        console.log(
            "======================================"
        );

    }
);
