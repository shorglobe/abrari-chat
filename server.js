const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const rooms = new Set();

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/rooms", (req, res) => {
  const roomId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  rooms.add(roomId);

  res.json({
    success: true,
    roomId,
    link: `/room/${roomId}`
  });
});

app.get("/api/rooms/:id", (req, res) => {
  if (!rooms.has(req.params.id)) {
    return res.status(404).json({ success: false });
  }
  res.json({ success: true });
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (data) => {
    if (!data || !rooms.has(data.roomId)) return;

    socket.join(data.roomId);
    socket.data.roomId = data.roomId;
    socket.data.username = String(data.username || "Guest").slice(0, 25);

    socket.to(data.roomId).emit("user-joined", {
      username: socket.data.username
    });
  });

  socket.on("send-message", (data) => {
    const roomId = socket.data.roomId;
    const message = String(data?.message || "").trim();

    if (!roomId || !rooms.has(roomId)) return;
    if (!message || message.length > 2000) return;

    io.to(roomId).emit("receive-message", {
      id: crypto.randomUUID(),
      username: socket.data.username,
      message,
      senderId: socket.id,
      time: new Date().toISOString()
    });
  });

  socket.on("typing", () => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit("user-typing");
    }
  });

  socket.on("stop-typing", () => {
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit("user-stop-typing");
    }
  });
});

app.get("/room/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
  console.log(`Abrari Chat running at http://localhost:${PORT}`);
});