import dotenv from "dotenv";
dotenv.config();
import express, { Application, NextFunction, Request, Response } from "express";
import { WebSocketServer } from "ws";
import userRouter from "../routes/user.route";
import { User } from "../types/User";
import { Nodes, Room, WssMapping } from "../types/websocket";
import global from "../types/global";
import { randomInt, randomUUID } from "crypto";
const app: Application = express();

const PORT = process.env.PORT || 1726;

const wss = new WebSocketServer({
  port: 8080,
});

app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  })
);

// databases as mapping
const userList: Nodes[] = [];
const userMapping: WssMapping = {};
const Rooms: Room = {};
let user: User = {};
let roomIds: string[] = [];

let uniqueId: string;
let roomId: string;

// setting websocket connection
let connect = 0;
wss.on("connection", (ws: Nodes) => {
  uniqueId = randomUUID().substring(0, 8);
  roomId = randomUUID().substring(0, 8);
  connect++;
  console.log(connect);
  user = {
    userId: uniqueId,
  };
  roomIds.push(roomId);
  Rooms[roomId] = [];

  ws[uniqueId] = user;
  userList.push(ws);

  userMapping[uniqueId] = ws;

  // console.log(randomInt(roomIds.length));
  console.log(roomIds);

  ws.send(
    JSON.stringify({
      user: ws[uniqueId].userId,
    })
  );

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    console.log(data);

    if (data.join) {
      const { userId } = data.join;

      if (roomIds.length <= 0) {
        roomId = randomUUID().substring(0, 8);
        Rooms[roomId] = [];
        Rooms[roomId][0] = userId;
        userMapping[userId].send(
          JSON.stringify({
            roomInfo: {
              roomId: roomId,
              members: Rooms[roomId],
            },
          })
        );
      } else {
        const randomNumber = randomInt(roomIds.length);
        const getRandomRoomId =
          randomNumber > roomIds.length
            ? randomNumber - roomIds.length
            : randomNumber;

        const randomRoomId = roomIds[getRandomRoomId];
        if (Rooms[randomRoomId].length < 1 || Rooms[randomRoomId].length < 2) {
          Rooms[randomRoomId].push(userId);

          Rooms[randomRoomId].forEach((members) => {
            if (members) {
              userMapping[members].send(
                JSON.stringify({
                  roomInfo: {
                    roomId: randomRoomId,
                    members: Rooms[randomRoomId],
                  },
                })
              );
            }
          });
        } else if (Rooms[randomRoomId].length >= 2) {
          roomId = randomUUID().substring(0, 8);
          Rooms[roomId] = [];
          Rooms[roomId][0] = userId;
          userMapping[userId].send(
            JSON.stringify({
              roomInfo: {
                roomId: roomId,
                members: Rooms[roomId],
              },
            })
          );
        }
      }
    } else if (data.sendMsg) {
      const { roomId, from, to, message } = data.sendMsg;
      if (Rooms[roomId] && userMapping[from] && userMapping[to]) {
        userMapping[to].send(
          JSON.stringify({
            message: {
              roomId: roomId,
              from: from,
              message: message,
            },
          })
        );
      }
    } else if (data.left) {
      const { roomId, leftUser, roomMembers } = data.left;
      console.log(roomMembers);

      if (Rooms[roomId] && userMapping[leftUser]) {
        delete Rooms[roomId];

        let updatedRoom = roomIds.filter((rooms) => {
          return rooms !== roomId;
        });

        console.log("Deleted Room --->", roomId);
        roomIds = [...updatedRoom];
        console.log("Updated Rooms --->", updatedRoom);

        // message sent to the present user
        roomMembers.forEach((m: string) => {
          if (m !== leftUser) {
            userMapping[m].send(
              JSON.stringify({
                leave: `${leftUser} has left`,
              })
            );
          }
        });
      }
    }
  });

  ws.on("close", () => {
    connect--;
    console.log("Left");
  });
});

app.use((req: Request, res: Response, next: NextFunction) => {
  next();
});

app.use("/v1", userRouter);

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    msg: "Hello! I am omegle rest api :)",
  });
});

app.listen(PORT, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});
