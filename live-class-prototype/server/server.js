import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
    AccessToken,
    RoomServiceClient
} from "livekit-server-sdk";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

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

const roomService =
    new RoomServiceClient(
        LIVEKIT_URL,
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET
    );


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
            service: "live-class-prototype"
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
             *
             * maxParticipants:
             * يمكن تغييره لاحقًا.
             */

            const room =
                await roomService.createRoom({

                    name: roomName,

                    emptyTimeout: 60,

                    departureTimeout: 20,

                    maxParticipants: 500,

                    metadata:
                        JSON.stringify({

                            title,

                            teacherName,

                            createdAt:
                                new Date()
                                    .toISOString()

                        }),

                    /*
                     * Auto Egress
                     *
                     * التسجيل يبدأ تلقائيًا
                     * مع إنشاء الغرفة.
                     */

                    egress: {

                        room: {

                            layout: "speaker",

                            audioOnly: false,

                            videoOnly: false,

                            fileOutputs: [

                                {

                                    fileType: "MP4",

                                    filepath:
                                        `recordings/${roomName}.mp4`,

                                    s3: {

                                        accessKey:
                                            process.env.S3_ACCESS_KEY,

                                        secret:
                                            process.env.S3_SECRET,

                                        bucket:
                                            process.env.S3_BUCKET,

                                        region:
                                            process.env.S3_REGION,

                                        endpoint:
                                            process.env.S3_ENDPOINT || "",

                                        forcePathStyle:
                                            process.env.S3_FORCE_PATH_STYLE ===
                                            "true"

                                    }

                                }

                            ]

                        }

                    }

                });


            /*
             * Token للمدرس
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

                roomJoin: true,

                room:
                    roomName,

                canPublish: true,

                canSubscribe: true,

                canPublishData: true

            });


            const token =
                await teacherToken.toJwt();


            res.json({

                success: true,

                room: {

                    name:
                        roomName,

                    title,

                    teacherName

                },

                token,

                livekitUrl:
                    LIVEKIT_URL

            });

        } catch (error) {

            console.error(
                "Create room error:",
                error
            );

            res.status(500).json({

                success: false,

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
| الطالب أو أي مشارك يطلب Token للغرفة.
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

                    success: false,

                    error:
                        "roomName is required"

                });

            }


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

                roomJoin: true,

                room:
                    roomName,

                canPublish: true,

                canSubscribe: true,

                canPublishData: true

            });


            const jwt =
                await token.toJwt();


            res.json({

                success: true,

                token: jwt,

                livekitUrl:
                    LIVEKIT_URL

            });

        } catch (error) {

            console.error(
                "Join room error:",
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message ||
                    "Failed to join room"

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
            `Live Class Prototype Server running on port ${PORT}`
        );

    }
);
