import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import {
    AccessToken,
    RoomServiceClient
} from "livekit-server-sdk";


dotenv.config();


const app =
    express();


app.use(
    cors()
);


app.use(
    express.json()
);


/* =====================================================
   Configuration
===================================================== */

const PORT =
    process.env.PORT ||
    3000;


const LIVEKIT_URL =
    process.env.LIVEKIT_URL ||
    "ws://localhost:7880";


const LIVEKIT_HTTP_URL =
    LIVEKIT_URL
        .replace(
            "ws://",
            "http://"
        )
        .replace(
            "wss://",
            "https://"
        );


const API_KEY =
    process.env.LIVEKIT_API_KEY ||
    "devkey";


const API_SECRET =
    process.env.LIVEKIT_API_SECRET ||
    "secret";


const roomService =
    new RoomServiceClient(
        LIVEKIT_HTTP_URL,
        API_KEY,
        API_SECRET
    );


/* =====================================================
   Health
===================================================== */

app.get(
    "/",
    (req, res) => {

        res.json({

            ok: true,

            service:
                "Nursing Live Class Prototype",

            livekit:
                true,

            recording:
                true

        });

    }
);


/* =====================================================
   Create Room
===================================================== */

app.post(
    "/api/create-room",
    async (req, res) => {

        try {

            const {
                roomName
            } = req.body;


            if (!roomName) {

                return res
                    .status(400)
                    .json({

                        error:
                            "roomName مطلوب."

                    });

            }


            /*
             * إنشاء الغرفة.
             *
             * Auto Egress:
             *
             * يبدأ تسجيل Room Composite
             * تلقائيًا عندما يدخل أول مشارك.
             *
             * ويتوقف عندما يغادر الجميع.
             */

            const room =
                await roomService.createRoom({

                    name:
                        roomName,

                    emptyTimeout:
                        300,

                    departureTimeout:
                        20,

                    maxParticipants:
                        500,

                    egress: {

                        room: {

                            layout:
                                "speaker",

                            fileOutputs: [

                                {

                                    fileType:
                                        "MP4",

                                    filepath:
                                        `recordings/${roomName}-{time}.mp4`,

                                    s3: {

                                        accessKey:
                                            "prototype",

                                        secret:
                                            "prototype-secret",

                                        region:
                                            "us-east-1",

                                        bucket:
                                            "recordings",

                                        endpoint:
                                            "http://minio:9000",

                                        forcePathStyle:
                                            true

                                    }

                                }

                            ]

                        }

                    }

                });


            res.json({

                ok:
                    true,

                room: {

                    name:
                        room.name,

                    sid:
                        room.sid

                }

            });


        } catch (error) {

            console.error(
                "Create room error:",
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "فشل إنشاء الغرفة.",

                    details:
                        error.message

                });

        }

    }
);


/* =====================================================
   Token
===================================================== */

app.post(
    "/api/token",
    async (req, res) => {

        try {

            const {

                roomName,

                identity,

                role

            } = req.body;


            if (
                !roomName ||
                !identity
            ) {

                return res
                    .status(400)
                    .json({

                        error:
                            "roomName و identity مطلوبان."

                    });

            }


            const isTeacher =
                role ===
                "teacher";


            const token =
                new AccessToken(

                    API_KEY,

                    API_SECRET,

                    {

                        identity:

                            identity,

                        name:

                            identity,

                        ttl:

                            "2h"

                    }

                );


            token.addGrant({

                roomJoin:
                    true,

                room:
                    roomName,

                canPublish:
                    isTeacher,

                canSubscribe:
                    true,

                canPublishData:
                    true

            });


            const jwt =
                await token.toJwt();


            res.json({

                ok:
                    true,

                token:
                    jwt,

                url:
                    LIVEKIT_URL

            });


        } catch (error) {

            console.error(
                "Token error:",
                error
            );


            res
                .status(500)
                .json({

                    error:
                        "فشل إنشاء Token."

                });

        }

    }
);


/* =====================================================
   Start Server
===================================================== */

app.listen(
    PORT,
    () => {

        console.log(
            "================================="
        );

        console.log(
            " Nursing Live Class Prototype"
        );

        console.log(
            "================================="
        );

        console.log(
            `Server: http://localhost:${PORT}`
        );

        console.log(
            `LiveKit: ${LIVEKIT_URL}`
        );

        console.log(
            "Auto Egress: ENABLED"
        );

    }
);
