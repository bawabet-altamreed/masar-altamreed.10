import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import {
    AccessToken
} from "livekit-server-sdk";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT =
    process.env.PORT || 3000;

const LIVEKIT_URL =
    process.env.LIVEKIT_URL;

const API_KEY =
    process.env.LIVEKIT_API_KEY;

const API_SECRET =
    process.env.LIVEKIT_API_SECRET;


/* =========================================
   Health
========================================= */

app.get(
    "/",
    (req, res) => {

        res.json({
            ok: true,
            service: "Live Class Prototype"
        });

    }
);


/* =========================================
   Create Token
========================================= */

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

                return res.status(400).json({
                    error:
                        "roomName و identity مطلوبان."
                });

            }


            const isTeacher =
                role === "teacher";


            const token =
                new AccessToken(
                    API_KEY,
                    API_SECRET,
                    {
                        identity,
                        name: identity,
                        ttl: "2h"
                    }
                );


            token.addGrant({

                roomJoin: true,

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

                token: jwt,

                url:
                    LIVEKIT_URL

            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                error:
                    "فشل إنشاء Token."

            });

        }

    }
);


app.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );

    }
);

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

const PORT =
    process.env.PORT || 3000;

const LIVEKIT_URL =
    process.env.LIVEKIT_URL ||
    "ws://localhost:7880";

const HTTP_LIVEKIT_URL =
    LIVEKIT_URL
        .replace("ws://", "http://")
        .replace("wss://", "https://");

const API_KEY =
    process.env.LIVEKIT_API_KEY ||
    "devkey";

const API_SECRET =
    process.env.LIVEKIT_API_SECRET ||
    "secret";


const roomService =
    new RoomServiceClient(
        HTTP_LIVEKIT_URL,
        API_KEY,
        API_SECRET
    );


/* =========================================
   Health
========================================= */

app.get(
    "/",
    (req, res) => {

        res.json({
            ok: true,
            service: "Live Class Prototype"
        });

    }
);


/* =========================================
   Create Room
========================================= */

app.post(
    "/api/create-room",
    async (req, res) => {

        try {

            const {
                roomName
            } = req.body;


            if (!roomName) {

                return res.status(400).json({
                    error:
                        "roomName مطلوب."
                });

            }


            const room =
                await roomService.createRoom({

                    name: roomName,

                    emptyTimeout: 300,

                    departureTimeout: 20,

                    maxParticipants: 500

                });


            res.json({

                ok: true,

                room: room.name

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                error:
                    "فشل إنشاء الغرفة."

            });

        }

    }
);


/* =========================================
   Token
========================================= */

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

                return res.status(400).json({
                    error:
                        "roomName و identity مطلوبان."
                });

            }


            const teacher =
                role === "teacher";


            const token =
                new AccessToken(
                    API_KEY,
                    API_SECRET,
                    {
                        identity,
                        name: identity,
                        ttl: "2h"
                    }
                );


            token.addGrant({

                roomJoin: true,

                room:
                    roomName,

                canPublish:
                    teacher,

                canSubscribe:
                    true,

                canPublishData:
                    true

            });


            const jwt =
                await token.toJwt();


            res.json({

                token: jwt,

                url:
                    LIVEKIT_URL

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                error:
                    "فشل إنشاء Token."

            });

        }

    }
);


app.listen(
    PORT,
    () => {

        console.log(
            `Server running on http://localhost:${PORT}`
        );

    }
);
