/* =========================================
   ABRARI CHAT
   Backend Server
   Media Upload Enabled
========================================= */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// =========================================
// INITIAL SETUP
// =========================================

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const io = new Server(server);

// =========================================
// MIDDLEWARE
// =========================================

app.use(express.json({ limit: "1mb" }));

app.use(express.static(path.join(__dirname, "public")));

// =========================================
// UPLOAD DIRECTORY
// =========================================

const uploadFolder = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

// =========================================
// MULTER STORAGE
// =========================================

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },

  filename: (req, file, cb) => {

    const extension = path.extname(file.originalname);

    const uniqueName =
      Date.now() +
      "-" +
      crypto.randomUUID() +
      extension;

    cb(null, uniqueName);
  }

});

// =========================================
// ALLOWED FILE TYPES
// =========================================

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",

  "video/mp4",
  "video/webm",
  "video/quicktime",

  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",

  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv"
];

// =========================================
// MULTER CONFIGURATION
// =========================================

const upload = multer({

  storage,

  limits: {
    fileSize: 25 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed"));
    }

  }

});

// Serve uploaded files
app.use(
  "/uploads",
  express.static(uploadFolder)
);

// =========================================
// TEMPORARY ROOM STORAGE
// =========================================

const rooms = new Set();

// =========================================
// HEALTH CHECK
// =========================================

app.get("/api/health", (req, res) => {

  res.json({
    success: true,
    message: "Abrari Chat server is running",
    mediaUpload: true
  });

});

// =========================================
// CREATE ROOM
// =========================================

app.post("/api/rooms", (req, res) => {

  try {

    const roomId = crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 12);

    rooms.add(roomId);

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

// =========================================
// MEDIA UPLOAD API
// =========================================

app.post(
  "/api/upload",
  upload.single("file"),
  (req, res) => {

    try {

      const roomId = String(req.body.roomId || "");

      const username = String(req.body.username || "Guest")
        .trim()
        .slice(0, 25);

      if (!rooms.has(roomId)) {

        if (req.file) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(404).json({
          success: false,
          message: "Room not found"
        });

      }

      if (!req.file) {

        return res.status(400).json({
          success: false,
          message: "No file uploaded"
        });

      }

      const mediaData = {

        id: crypto.randomUUID(),

        roomId,

        username,

        originalName: req.file.originalname,

        fileName: req.file.filename,

        fileType: req.file.mimetype,

        fileSize: req.file.size,

        url: `/uploads/${req.file.filename}`,

        time: new Date().toISOString()

      };

      // Send uploaded media to room members
      io.to(roomId).emit("receive-media", mediaData);

      res.status(201).json({

        success: true,

        message: "File uploaded successfully",

        media: mediaData

      });

    } catch (error) {

      console.error("Upload error:", error);

      res.status(500).json({
        success: false,
        message: "Upload failed"
      });

    }

  }
);

// =========================================
// SOCKET.IO CONNECTION
// =========================================

io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  // =======================================
  // JOIN ROOM
  // =======================================

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

  // =======================================
  // SEND TEXT MESSAGE
  // =======================================

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

  // =======================================
  // TYPING
  // =======================================

  socket.on("typing", () => {

    const roomId = socket.data.roomId;

    if (!roomId || !rooms.has(roomId)) return;

    socket.to(roomId).emit("user-typing");

  });

  // =======================================
  // STOP TYPING
  // =======================================

  socket.on("stop-typing", () => {

    const roomId = socket.data.roomId;

    if (!roomId || !rooms.has(roomId)) return;

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
// DEFAULT ROUTE
// =========================================

app.get("/{*splat}", (req, res) => {

  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );

});

// =========================================
// ERROR HANDLER
// =========================================

app.use((error, req, res, next) => {

  console.error("Server error:", error.message);

  if (error instanceof multer.MulterError) {

    return res.status(400).json({
      success: false,
      message: error.code === "LIMIT_FILE_SIZE"
        ? "File size must be 25 MB or less"
        : "File upload error"
    });

  }

  res.status(400).json({
    success: false,
    message: error.message || "Something went wrong"
  });

});

// =========================================
// START SERVER
// =========================================

server.listen(PORT, () => {

  console.log("--------------------------------");
  console.log("ABRARI CHAT SERVER RUNNING");
  console.log("MEDIA UPLOAD ENABLED");
  console.log(`Port: ${PORT}`);
  console.log("--------------------------------");

});
