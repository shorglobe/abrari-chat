/* =========================================
   ABRARI CHAT
   Backend Server + MongoDB Atlas
========================================= */

require("dotenv").config();

const { MongoClient } = require("mongodb");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");

// =========================================
// INITIAL SETUP
// =========================================

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || true,
    methods: ["GET", "POST"]
  }
});

// =========================================
// MONGODB CONNECTION
// =========================================

const client = new MongoClient(process.env.MONGODB_URI);

let db;
let roomsCollection;
let messagesCollection;

async function connectDB() {
  try {
    await client.connect();

    db = client.db("abrari_chat");

    roomsCollection = db.collection("rooms");
    messagesCollection = db.collection("messages");

    console.log("MongoDB Connected Successfully!");

  } catch (error) {
    console.error("MongoDB Connection Failed:", error);
    process.exit(1);
  }
}

// =========================================
// MIDDLEWARE
// =========================================

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL;
  const requestOrigin = req.headers.origin;

  if (frontendUrl && requestOrigin === frontendUrl) {
    res.setHeader("Access-Control-Allow-Origin", frontendUrl);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.static(path.join(__dirname, "public")));

// =========================================
// HEALTH CHECK
// =========================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Abrari Chat server is running"
  });
});

// =========================================
// CREATE ROOM
// =========================================

app.post("/api/rooms", async (req, res) => {
  try {
    const roomId = crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 12);

    const roomData = {
      roomId,
      createdAt: new Date()
    };

    await roomsCollection.insertOne(roomData);

    res.status(201).json({
      success: true,
      roomId,
      link: `/room/${roomId}`
    });

  } catch (error) {
    console.error("Room creation error:", error);

    res.status(500).json({
      success: false,
      message: "Could not create room"
    });
  }
});

// =========================================
// CHECK ROOM
// =========================================

app.get("/api/rooms/:id", async (req, res) => {
  try {
    const roomId = req.params.id;

    const room = await roomsCollection.findOne({ roomId });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    res.json({
      success: true,
      roomId
    });

  } catch (error) {
    console.error("Room check error:", error);

    res.status(500).json({
      success: false,
      message: "Could not check room"
    });
  }
});

// =========================================
// GET ROOM MESSAGE HISTORY
// =========================================

app.get("/api/rooms/:id/messages", async (req, res) => {
  try {
    const roomId = req.params.id;

    const room = await roomsCollection.findOne({ roomId });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const messages = await messagesCollection
      .find({ roomId })
      .sort({ createdAt: 1 })
      .limit(100)
      .toArray();

    res.json({
      success: true,
      messages
    });

  } catch (error) {
    console.error("Message history error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load messages"
    });
  }
});

// =========================================
// SOCKET.IO CONNECTION
// =========================================

io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  // =======================================
  // JOIN ROOM
  // =======================================

  socket.on("join-room", async (data) => {
    try {
      if (!data || typeof data !== "object") return;

      const roomId = String(data.roomId || "");

      const username = String(data.username || "Guest")
        .trim()
        .slice(0, 25);

      if (!roomId || !username) return;

      const room = await roomsCollection.findOne({ roomId });

      if (!room) return;

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

  // =======================================
  // SEND MESSAGE
  // =======================================

  socket.on("send-message", async (data) => {
    try {
      const roomId = socket.data.roomId;

      if (!roomId) return;

      const message = String(data?.message || "").trim();

      if (!message || message.length > 2000) return;

      const room = await roomsCollection.findOne({ roomId });

      if (!room) return;

      const messageData = {
        id: crypto.randomUUID(),
        roomId,
        username: socket.data.username,
        message,
        senderId: socket.id,
        createdAt: new Date()
      };

      // Save message in MongoDB
      await messagesCollection.insertOne(messageData);

      // Send message to everyone in the room
      io.to(roomId).emit("receive-message", {
        ...messageData,
        time: messageData.createdAt.toISOString()
      });

    } catch (error) {
      console.error("Message error:", error);
    }
  });

  // =======================================
  // TYPING
  // =======================================

  socket.on("typing", () => {
    const roomId = socket.data.roomId;

    if (!roomId) return;

    socket.to(roomId).emit("user-typing");
  });

  // =======================================
  // STOP TYPING
  // =======================================

  socket.on("stop-typing", () => {
    const roomId = socket.data.roomId;

    if (!roomId) return;

    socket.to(roomId).emit("user-stop-typing");
  });

  // =======================================
  // DISCONNECT
  // =======================================

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });

});

// =========================================
// ROOM PAGE
// =========================================

app.get("/room/:id", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// =========================================
// DEFAULT FRONTEND ROUTE
// =========================================

app.get("/{*splat}", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// =========================================
// START SERVER
// =========================================

async function startServer() {
  await connectDB();

  server.listen(PORT, () => {
    console.log("--------------------------------");
    console.log("ABRARI CHAT SERVER RUNNING");
    console.log(`Port: ${PORT}`);
    console.log("--------------------------------");
  });
}

startServer();
