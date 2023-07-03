const express = require("express");
const socket = require("socket.io");
const morgan = require("morgan");
require("dotenv").config();
const cors = require("cors");
const app = express();
const { readFileSync } = require("fs");
const { createServer } = require("https");

const bodyParser = require("body-parser");
const compression = require("compression");
const userRoutes = require("./routes/userRoute");
const messagesRoutes = require("./routes/messagesRoute");
const uploadRoutes = require("./routes/uploadRoute");
const roomRoutes = require("./routes/roomRoute");
const { userJoin, getCurrentUser } = require("./utils/userSocket");

app.use(morgan("dev"));
app.use(cors());
app.use(express.static("public"));
app.use(compression());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use("/api/auth", userRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/rooms", roomRoutes);

const httpsServer = createServer({
  key: readFileSync("/path/to/server-key.pem"),
  cert: readFileSync("/path/to/server-cert.pem"),
  requestCert: true,
  ca: [readFileSync("/path/to/client-cert.pem")],
});

/**Config Socket.io */
const io = new socket(httpsServer, {
  cors: {
    origin: process.env.REACT_APP,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

httpsServer.listen(process.env.PORT, () => {
  console.log(`Server is running port ${process.env.PORT}`);
});

const sockets = new Map();

io.on("connection", (socket) => {
  console.log(`⚡: ${socket.id} user just connected!`);
  global.chatSocket = socket;

  socket.on("add-user", (userId) => {
    sockets.set(userId, socket.id);
  });

  socket.on("join-room", ({ room, userId }) => {
    console.log(`Data socket id::${userId} with roomID::${room}`);
    const user = userJoin(userId, room);
    socket.join(user.room);
  });

  socket.on("Send-message-room", (msg) => {
    const user = getCurrentUser(msg?.from);
    socket.to(user.room).emit("recieve-message-room", msg);
  });
  socket.on("send-msg", (data) => {
    const sendUserSocket = sockets.get(data?.to);
    if (sendUserSocket) {
      socket.to(sendUserSocket).emit("msg-recieve", data.message);
    }
  });

  socket.on("typing", (data) => socket.broadcast.emit("typingResponse", data));

  socket.on("disconnect", () => {
    console.log("🔥: A user disconnected");
  });
});

/**Config Socket.io End*/
