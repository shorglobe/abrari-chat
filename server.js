/* =========================================
   ABRARI CHAT
   Backend Server - Basic Version
========================================= */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

// INITIAL SETUP

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// MIDDLEWARE

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// TEMPORARY ROOM STORAGE

const rooms = new Set();

// HEALTH CHECK

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Abrari Chat server is running"
  });
});

// CREATE ROOM

app.post("/api/rooms", (req, res) => {
  try {
    const roomId = crypto.randomUUID()
      .replace(/-/g, "")
      .slice(0, 12);

    rooms.add(roomId);

    res.status(201).json({
      success: true,
      roomId,
      link: `/room/${roomId}`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Could not create room"
    });
  }
});

// CHECK ROOM

app.get("/api/rooms/:id", (req, res) => {
  const roomId = req.params.id;

  if (!rooms.has(roomId)) {
    return res.status(404).json({
      success: false,
      message: "Room not found"
    });
  }

  res.json({
    success: true,
    roomId
  });
});

// SOCKET.IO

io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  // JOIN ROOM

  socket.on("join-room", (data) => {
    try {
      if (!data || typeof data !== "object") return;

      const roomId = String(data.roomId || "");
      const username = String(data.username || "Guest")
        .trim()
        .slice(0, 25);

      if (!rooms.has(roomId) || !username) return;

      if (socket.data.roomId) {
        socket.leave(socket.data.roomId);
      }

      socket.join(roomId);

      socket.data.roomId = roomId;
      socket.data.username = username;

      console.log(`${username} joined room ${roomId}`);

      socket.to(roomId).emit("user-joined", {
        username
      });

    } catch (error) {
      console.error("Join room error:", error);
    }
  });

  // SEND MESSAGE

  socket.on("send-message", (data) => {
    try {
      const roomId = socket.data.roomId;

      if (!roomId || !rooms.has(roomId)) return;

      const message = String(data?.message || "").trim();

      if (!message || message.length > 2000) return;

      const messageData = {
        id: crypto.randomUUID(),
        username: socket.data.username,
        message,
        senderId: socket.id,
        time: new Date().toISOString()
      };

      io.to(roomId).emit("receive-message", messageData);

    } catch (error) {
      console.error("Message error:", error);
    }
  });

  // TYPING

  socket.on("typing", () => {
    const roomId = socket.data.roomId;

    if (!roomId) return;

    socket.to(roomId).emit("user-typing");
  });

  // STOP TYPING

  socket.on("stop-typing", () => {
    const roomId = socket.data.roomId;

    if (!roomId) return;

    socket.to(roomId).emit("user-stop-typing");
  });

  // DISCONNECT

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

});

// ROOM PAGE

app.get("/room/:id", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// DEFAULT ROUTE

app.get("/{*splat}", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// START SERVER

server.listen(PORT, () => {
  console.log("--------------------------------");
  console.log("ABRARI CHAT SERVER RUNNING");
  console.log(`Port: ${PORT}`);
  console.log("--------------------------------");
});
