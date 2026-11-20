/* =========================================
   ABRARI CHAT
   Step 3 - Frontend JavaScript
========================================= */

// Socket connection
const socket = io({
  autoConnect: false
});

// API
const API_BASE = "";

// Main elements
const homePage = document.getElementById("homePage");
const chatPage = document.getElementById("chatPage");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const enterChatBtn = document.getElementById("enterChatBtn");

const usernameInput = document.getElementById("usernameInput");
const roomLinkInput = document.getElementById("roomLink");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");

const shareBtn = document.getElementById("shareBtn");
const connectionStatus = document.getElementById("connectionStatus");
const typingIndicator = document.getElementById("typingIndicator");

// Attachment elements
const attachmentBtn = document.getElementById("attachmentBtn");
const attachmentMenu = document.getElementById("attachmentMenu");

const attachmentPreview = document.getElementById("attachmentPreview");
const attachmentInfo = document.getElementById("attachmentInfo");
const removeAttachmentBtn = document.getElementById("removeAttachmentBtn");

const imageInput = document.getElementById("imageInput");
const videoInput = document.getElementById("videoInput");
const documentInput = document.getElementById("documentInput");
const audioInput = document.getElementById("audioInput");

// Emoji elements
const emojiBtn = document.getElementById("emojiBtn");
const emojiPanel = document.getElementById("emojiPanel");

// Voice elements
const voiceBtn = document.getElementById("voiceBtn");
const recordingPanel = document.getElementById("recordingPanel");
const recordingTimer = document.getElementById("recordingTimer");
const cancelRecordingBtn = document.getElementById("cancelRecordingBtn");
const stopRecordingBtn = document.getElementById("stopRecordingBtn");

// State
let currentUsername = "";
let currentRoomId = "";
let selectedFile = null;

let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let recordingSeconds = 0;
let typingTimeout = null;


// =========================================
// HELPER FUNCTIONS
// =========================================

function getElement(id) {
  return document.getElementById(id);
}

function showElement(element) {
  if (element) element.classList.remove("hidden");
}

function hideElement(element) {
  if (element) element.classList.add("hidden");
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getRoomId() {
  const match = window.location.pathname.match(/^\/room\/([a-zA-Z0-9_-]+)\/?$/);
  return match ? match[1] : null;
}

function setConnectionStatus(status, text) {
  if (!connectionStatus) return;

  connectionStatus.textContent = text || status;

  const dot = document.getElementById("connectionDot");

  if (dot) {
    dot.style.background =
      status === "connected" ? "#38d996" : "#ff647c";
  }
}


// =========================================
// CREATE ROOM
// =========================================

if (createRoomBtn) {
  createRoomBtn.addEventListener("click", async () => {
    try {
      createRoomBtn.disabled = true;
      createRoomBtn.textContent = "Creating...";

      const response = await fetch(`${API_BASE}/api/rooms`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Could not create room");
      }

      const data = await response.json();

      if (!data.success || !data.link) {
        throw new Error("Invalid server response");
      }

      window.location.href = data.link;

    } catch (error) {
      console.error(error);
      alert("Room creation failed. Please try again.");

      createRoomBtn.disabled = false;
      createRoomBtn.textContent = "Create Room";
    }
  });
}


// =========================================
// JOIN ROOM
// =========================================

if (joinRoomBtn) {
  joinRoomBtn.addEventListener("click", () => {
    const link = roomLinkInput?.value.trim();

    if (!link) {
      alert("Please enter a room link.");
      return;
    }

    try {
      const url = new URL(link, window.location.origin);
      const match = url.pathname.match(/^\/room\/([a-zA-Z0-9_-]+)\/?$/);

      if (!match) {
        alert("Invalid room link.");
        return;
      }

      window.location.href = `/room/${match[1]}`;

    } catch {
      alert("Please enter a valid room link.");
    }
  });
}


// =========================================
// INITIALIZE ROOM
// =========================================

async function initialize() {
  currentRoomId = getRoomId();

  if (!currentRoomId) {
    showElement(homePage);
    hideElement(chatPage);
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/rooms/${encodeURIComponent(currentRoomId)}`
    );

    if (!response.ok) {
      alert("Room not found or expired.");
      window.location.href = "/";
      return;
    }

    const data = await response.json();

    if (!data.success) {
      alert("This room is not available.");
      window.location.href = "/";
      return;
    }

    hideElement(homePage);
    showElement(chatPage);

    const nameModal = document.getElementById("nameModal");
    showElement(nameModal);

    usernameInput?.focus();

  } catch (error) {
    console.error(error);
    alert("Unable to connect to the server.");
  }
}


// =========================================
// ENTER CHAT
// =========================================

if (enterChatBtn) {
  enterChatBtn.addEventListener("click", enterChat);
}

if (usernameInput) {
  usernameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      enterChat();
    }
  });
}

function enterChat() {
  const username = usernameInput?.value.trim();

  if (!username) {
    alert("Please enter your name.");
    return;
  }

  if (username.length > 25) {
    alert("Name must be 25 characters or less.");
    return;
  }

  currentUsername = username;

  hideElement(document.getElementById("nameModal"));

  socket.connect();
}


// =========================================
// SOCKET CONNECTION
// =========================================

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  setConnectionStatus("connected", "Connected");

  socket.emit("join-room", {
    roomId: currentRoomId,
    username: currentUsername
  });
});

socket.on("disconnect", () => {
  console.log("Disconnected");

  setConnectionStatus("disconnected", "Reconnecting...");
});

socket.on("connect_error", (error) => {
  console.error("Socket error:", error);
  setConnectionStatus("disconnected", "Connection error");
});

socket.on("user-joined", (data) => {
  displaySystemMessage(`${data.username} joined the room`);
});


// =========================================
// RECEIVE TEXT MESSAGE
// =========================================

socket.on("receive-message", (data) => {
  displayMessage(data);
});


// =========================================
// DISPLAY MESSAGE
// =========================================

function displayMessage(data) {
  if (!messages) return;

  const messageElement = document.createElement("div");

  const isMine = data.senderId === socket.id;

  messageElement.className = `message ${isMine ? "mine" : "theirs"}`;

  const nameElement = document.createElement("div");
  nameElement.className = "message-name";
  nameElement.textContent = isMine ? "You" : data.username;

  const textElement = document.createElement("div");
  textElement.textContent = data.message;

  const timeElement = document.createElement("div");
  timeElement.className = "message-time";

  const messageDate = data.time ? new Date(data.time) : new Date();

  timeElement.textContent = formatTime(
    Number.isNaN(messageDate.getTime()) ? new Date() : messageDate
  );

  messageElement.append(nameElement, textElement, timeElement);

  messages.appendChild(messageElement);

  messages.scrollTop = messages.scrollHeight;
}


// =========================================
// SYSTEM MESSAGE
// =========================================

function displaySystemMessage(message) {
  if (!messages) return;

  const element = document.createElement("div");

  element.className = "system-message";
  element.textContent = message;

  messages.appendChild(element);
  messages.scrollTop = messages.scrollHeight;
}


// =========================================
// SEND TEXT MESSAGE
// =========================================

if (messageForm) {
  messageForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (selectedFile) {
      sendSelectedFile();
      return;
    }

    const message = messageInput?.value.trim();

    if (!message || !socket.connected) return;

    socket.emit("send-message", {
      message
    });

    messageInput.value = "";

    socket.emit("stop-typing");
  });
}


// =========================================
// TYPING INDICATOR
// =========================================

if (messageInput) {
  messageInput.addEventListener("input", () => {
    if (!socket.connected) return;

    socket.emit("typing");

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
      socket.emit("stop-typing");
    }, 1000);
  });
}

socket.on("user-typing", () => {
  showElement(typingIndicator);
});

socket.on("user-stop-typing", () => {
  hideElement(typingIndicator);
});


// =========================================
// SHARE ROOM
// =========================================

if (shareBtn) {
  shareBtn.addEventListener("click", async () => {
    const roomUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join Abrari Chat",
          text: "Join my chat room!",
          url: roomUrl
        });
      } else {
        await navigator.clipboard.writeText(roomUrl);
        alert("Room link copied!");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(error);
        alert("Unable to share the room link.");
      }
    }
  });
}


// =========================================
// ATTACHMENT MENU
// =========================================

if (attachmentBtn) {
  attachmentBtn.addEventListener("click", () => {
    attachmentMenu?.classList.toggle("hidden");
    hideElement(emojiPanel);
  });
}

document.querySelectorAll("[data-attach]").forEach((button) => {
  button.addEventListener("click", () => {
    const type = button.dataset.attach;

    hideElement(attachmentMenu);

    const inputMap = {
      image: imageInput,
      video: videoInput,
      document: documentInput,
      audio: audioInput
    };

    inputMap[type]?.click();
  });
});


// =========================================
// FILE SELECTION
// =========================================

const fileInputs = [
  imageInput,
  videoInput,
  documentInput,
  audioInput
].filter(Boolean);

fileInputs.forEach((input) => {
  input.addEventListener("change", () => {
    const file = input.files?.[0];

    if (!file) return;

    selectFile(file);

    // Allows selecting the same file again
    input.value = "";
  });
});


function selectFile(file) {
  const maxSize = 25 * 1024 * 1024;

  if (file.size > maxSize) {
    alert("File size must be 25 MB or less.");
    return;
  }

  selectedFile = file;

  if (attachmentInfo) {
    attachmentInfo.textContent =
      `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
  }

  showElement(attachmentPreview);
  messageInput?.focus();
}


// =========================================
// REMOVE ATTACHMENT
// =========================================

if (removeAttachmentBtn) {
  removeAttachmentBtn.addEventListener("click", () => {
    selectedFile = null;
    hideElement(attachmentPreview);
  });
}


// =========================================
// SEND SELECTED FILE
// =========================================

function sendSelectedFile() {
  if (!selectedFile) return;

  if (!socket.connected) {
    alert("Please wait for the chat connection.");
    return;
  }

  /*
    Media upload will be connected to the backend
    and cloud storage in the next development step.

    Do not send large files directly through Socket.IO.
  */

  alert(
    "File selected successfully! Media upload will be enabled after backend setup."
  );
}


// =========================================
// EMOJI PICKER
// =========================================

if (emojiBtn) {
  emojiBtn.addEventListener("click", () => {
    emojiPanel?.classList.toggle("hidden");
    hideElement(attachmentMenu);
  });
}

document.querySelectorAll("[data-emoji]").forEach((button) => {
  button.addEventListener("click", () => {
    const emoji = button.dataset.emoji;

    if (!messageInput || !emoji) return;

    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;

    const oldText = messageInput.value;

    messageInput.value =
      oldText.slice(0, start) +
      emoji +
      oldText.slice(end);

    messageInput.focus();

    const newPosition = start + emoji.length;

    messageInput.setSelectionRange(newPosition, newPosition);

    hideElement(emojiPanel);
  });
});


// =========================================
// VOICE RECORDING
// =========================================

if (voiceBtn) {
  voiceBtn.addEventListener("click", startRecording);
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    alert("Voice recording is not supported in this browser.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    audioChunks = [];

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());

      if (audioChunks.length === 0) return;

      const audioBlob = new Blob(audioChunks, {
        type: mediaRecorder.mimeType || "audio/webm"
      });

      const audioFile = new File(
        [audioBlob],
        `voice-message-${Date.now()}.webm`,
        { type: audioBlob.type }
      );

      selectFile(audioFile);

      hideElement(recordingPanel);
      clearInterval(recordingInterval);
    };

    mediaRecorder.start();

    recordingSeconds = 0;

    showElement(recordingPanel);

    if (recordingTimer) {
      recordingTimer.textContent = "00:00";
    }

    recordingInterval = setInterval(() => {
      recordingSeconds++;

      const minutes = String(
        Math.floor(recordingSeconds / 60)
      ).padStart(2, "0");

      const seconds = String(
        recordingSeconds % 60
      ).padStart(2, "0");

      if (recordingTimer) {
        recordingTimer.textContent = `${minutes}:${seconds}`;
      }

      if (recordingSeconds >= 180) {
        stopRecording();
      }
    }, 1000);

  } catch (error) {
    console.error("Microphone error:", error);
    alert("Microphone permission is required for voice recording.");
  }
}


// =========================================
// STOP RECORDING
// =========================================

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }

  clearInterval(recordingInterval);
}


// =========================================
// CANCEL RECORDING
// =========================================

if (cancelRecordingBtn) {
  cancelRecordingBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.onstop = () => {
        mediaRecorder.stream
          ?.getTracks()
          .forEach((track) => track.stop());
      };

      mediaRecorder.stop();
    }

    audioChunks = [];

    clearInterval(recordingInterval);

    hideElement(recordingPanel);
  });
}

if (stopRecordingBtn) {
  stopRecordingBtn.addEventListener("click", stopRecording);
}


// =========================================
// CLOSE POPUPS WHEN CLICKING OUTSIDE
// =========================================

document.addEventListener("click", (event) => {
  if (
    attachmentMenu &&
    attachmentBtn &&
    !attachmentMenu.contains(event.target) &&
    !attachmentBtn.contains(event.target)
  ) {
    hideElement(attachmentMenu);
  }

  if (
    emojiPanel &&
    emojiBtn &&
    !emojiPanel.contains(event.target) &&
    !emojiBtn.contains(event.target)
  ) {
    hideElement(emojiPanel);
  }
});


// =========================================
// START APPLICATION
// =========================================

initialize();
