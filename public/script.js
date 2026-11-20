/* =========================================
   ABRARI CHAT
   Complete Frontend JavaScript
   Text Chat + Media Upload
========================================= */

// =========================================
// SOCKET CONNECTION
// =========================================

const socket = io({
  autoConnect: false
});

const API_BASE = "";

// =========================================
// MAIN ELEMENTS
// =========================================

const homePage = document.getElementById("homePage");
const chatPage = document.getElementById("chatPage");
const nameModal = document.getElementById("nameModal");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const enterChatBtn = document.getElementById("enterChatBtn");

const usernameInput = document.getElementById("usernameInput");
const roomLinkInput = document.getElementById("roomLinkInput");

const messageInput = document.getElementById("messageInput");
const messageForm = document.getElementById("messageForm");
const messages = document.getElementById("messages");

const shareBtn = document.getElementById("shareBtn");
const connectionStatus = document.getElementById("connectionStatus");
const typingIndicator = document.getElementById("typingIndicator");

// =========================================
// MEDIA ELEMENTS
// =========================================

const attachmentBtn = document.getElementById("attachmentBtn");
const attachmentMenu = document.getElementById("attachmentMenu");

const attachmentPreview = document.getElementById("attachmentPreview");
const attachmentInfo = document.getElementById("attachmentInfo");
const removeAttachmentBtn = document.getElementById("removeAttachmentBtn");

const imageInput = document.getElementById("imageInput");
const videoInput = document.getElementById("videoInput");
const documentInput = document.getElementById("documentInput");
const audioInput = document.getElementById("audioInput");

const emojiBtn = document.getElementById("emojiBtn");
const emojiPanel = document.getElementById("emojiPanel");

const voiceBtn = document.getElementById("voiceBtn");
const recordingPanel = document.getElementById("recordingPanel");
const recordingTimer = document.getElementById("recordingTimer");
const cancelRecordingBtn = document.getElementById("cancelRecordingBtn");
const stopRecordingBtn = document.getElementById("stopRecordingBtn");

// =========================================
// APP VARIABLES
// =========================================

let currentRoomId = null;
let currentUsername = "";

let selectedFile = null;

let mediaRecorder = null;
let audioChunks = [];

let recordingInterval = null;
let recordingSeconds = 0;

let cancelRecording = false;
let typingTimeout = null;

const MAX_FILE_SIZE = 25 * 1024 * 1024;

// =========================================
// HELPER FUNCTIONS
// =========================================

function getRoomId() {

  const pathParts = window.location.pathname.split("/");

  if (pathParts[1] === "room" && pathParts[2]) {
    return pathParts[2];
  }

  return null;
}

function formatTime(dateValue) {

  const date = new Date(dateValue);

  if (isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatFileSize(bytes) {

  if (bytes < 1024) {
    return bytes + " B";
  }

  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + " KB";
  }

  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function showAlert(message) {
  alert(message);
}

// =========================================
// PAGE NAVIGATION
// =========================================

function showHomePage() {

  if (homePage) homePage.style.display = "block";
  if (chatPage) chatPage.style.display = "none";
}

function showChatPage() {

  if (homePage) homePage.style.display = "none";
  if (chatPage) chatPage.style.display = "block";

}

// =========================================
// CREATE ROOM
// =========================================

if (createRoomBtn) {

  createRoomBtn.addEventListener("click", async () => {

    try {

      createRoomBtn.disabled = true;

      const response = await fetch(`${API_BASE}/api/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Room creation failed");
      }

      currentRoomId = data.roomId;

      if (roomLinkInput) {
        roomLinkInput.value =
          window.location.origin + data.link;
      }

      openUsernameModal();

    } catch (error) {

      console.error("Create room error:", error);
      showAlert(error.message);

    } finally {

      createRoomBtn.disabled = false;

    }

  });

}

// =========================================
// JOIN ROOM
// =========================================

if (joinRoomBtn) {

  joinRoomBtn.addEventListener("click", async () => {

    const roomId = getRoomIdFromInput();

    if (!roomId) {
      showAlert("Please enter a valid room ID or room link.");
      return;
    }

    try {

      joinRoomBtn.disabled = true;

      const response = await fetch(
        `${API_BASE}/api/rooms/${encodeURIComponent(roomId)}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Room not found");
      }

      currentRoomId = data.roomId;

      openUsernameModal();

    } catch (error) {

      console.error("Join room error:", error);
      showAlert(error.message);

    } finally {

      joinRoomBtn.disabled = false;

    }

  });

}

// =========================================
// GET ROOM ID FROM INPUT
// =========================================

function getRoomIdFromInput() {

  const input = roomLinkInput?.value.trim();

  if (!input) return null;

  try {

    const url = new URL(input);

    const parts = url.pathname.split("/");

    if (parts[1] === "room" && parts[2]) {
      return parts[2];
    }

  } catch (error) {

    // Input may be a room ID instead of a URL.

  }

  return input.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
}

// =========================================
// USERNAME MODAL
// =========================================

function openUsernameModal() {

  if (nameModal) {
    nameModal.style.display = "flex";
  }

  if (usernameInput) {
    usernameInput.focus();
  }

}

if (enterChatBtn) {

  enterChatBtn.addEventListener("click", initializeChat);

}

if (usernameInput) {

  usernameInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
      initializeChat();
    }

  });

}

// =========================================
// INITIALIZE CHAT
// =========================================

function initializeChat() {

  const username = usernameInput?.value.trim();

  if (!username) {
    showAlert("Please enter your name.");
    return;
  }

  if (!currentRoomId) {
    showAlert("Room ID is missing.");
    return;
  }

  currentUsername = username.slice(0, 25);

  if (nameModal) {
    nameModal.style.display = "none";
  }

  showChatPage();

  if (window.location.pathname !== `/room/${currentRoomId}`) {

    window.history.pushState(
      {},
      "",
      `/room/${currentRoomId}`
    );

  }

  if (messages) {
    messages.innerHTML = "";
  }

  socket.connect();

}

// =========================================
// SOCKET CONNECTED
// =========================================

socket.on("connect", () => {

  console.log("Connected:", socket.id);

  if (connectionStatus) {
    connectionStatus.textContent = "Connected";
    connectionStatus.classList.add("connected");
  }

  socket.emit("join-room", {
    roomId: currentRoomId,
    username: currentUsername
  });

});

// =========================================
// SOCKET DISCONNECTED
// =========================================

socket.on("disconnect", () => {

  console.log("Disconnected");

  if (connectionStatus) {
    connectionStatus.textContent = "Disconnected";
    connectionStatus.classList.remove("connected");
  }

});

// =========================================
// USER JOINED
// =========================================

socket.on("user-joined", (data) => {

  showSystemMessage(`${data.username} joined the room`);

});

// =========================================
// RECEIVE TEXT MESSAGE
// =========================================

socket.on("receive-message", (data) => {

  displayMessage(data);

});

// =========================================
// RECEIVE MEDIA MESSAGE
// =========================================

socket.on("receive-media", (data) => {

  displayMediaMessage(data);

});

// =========================================
// SEND TEXT MESSAGE
// =========================================

if (messageForm) {

  messageForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!socket.connected) {
      showAlert("Not connected to chat.");
      return;
    }

    if (selectedFile) {
      await sendSelectedFile();
      return;
    }

    const message = messageInput?.value.trim();

    if (!message) return;

    socket.emit("send-message", {
      message
    });

    messageInput.value = "";

    socket.emit("stop-typing");

  });

}

// =========================================
// DISPLAY TEXT MESSAGE
// =========================================

function displayMessage(data) {

  if (!messages) return;

  const messageElement = document.createElement("div");

  messageElement.className = "message";

  const isOwnMessage = data.senderId === socket.id;

  if (isOwnMessage) {
    messageElement.classList.add("own-message");
  }

  const usernameElement = document.createElement("div");
  usernameElement.className = "message-username";
  usernameElement.textContent = data.username || "Guest";

  const textElement = document.createElement("div");
  textElement.className = "message-text";
  textElement.textContent = data.message || "";

  const timeElement = document.createElement("div");
  timeElement.className = "message-time";
  timeElement.textContent = formatTime(data.time);

  messageElement.appendChild(usernameElement);
  messageElement.appendChild(textElement);
  messageElement.appendChild(timeElement);

  messages.appendChild(messageElement);

  scrollToBottom();

}

// =========================================
// DISPLAY MEDIA MESSAGE
// =========================================

function displayMediaMessage(data) {

  if (!messages) return;

  const messageElement = document.createElement("div");

  messageElement.className = "message media-message";

  const isOwnMessage = data.username === currentUsername;

  if (isOwnMessage) {
    messageElement.classList.add("own-message");
  }

  const usernameElement = document.createElement("div");
  usernameElement.className = "message-username";
  usernameElement.textContent = data.username || "Guest";

  const mediaContainer = document.createElement("div");
  mediaContainer.className = "message-media";

  const url = data.url;

  if (!url || !url.startsWith("/uploads/")) return;

  const fileType = data.fileType || "";
  const fileName = data.originalName || "Attachment";

  if (fileType.startsWith("image/")) {

    const image = document.createElement("img");

    image.src = url;
    image.alt = fileName;
    image.loading = "lazy";
    image.className = "chat-image";

    mediaContainer.appendChild(image);

  } else if (fileType.startsWith("video/")) {

    const video = document.createElement("video");

    video.src = url;
    video.controls = true;
    video.preload = "metadata";
    video.className = "chat-video";

    mediaContainer.appendChild(video);

  } else if (fileType.startsWith("audio/")) {

    const audio = document.createElement("audio");

    audio.src = url;
    audio.controls = true;
    audio.preload = "metadata";
    audio.className = "chat-audio";

    mediaContainer.appendChild(audio);

  } else {

    const link = document.createElement("a");

    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "📄 " + fileName;
    link.className = "chat-document";

    mediaContainer.appendChild(link);

  }

  const fileInfo = document.createElement("div");
  fileInfo.className = "media-file-info";

  fileInfo.textContent =
    fileName + " • " + formatFileSize(data.fileSize || 0);

  const timeElement = document.createElement("div");
  timeElement.className = "message-time";
  timeElement.textContent = formatTime(data.time);

  messageElement.appendChild(usernameElement);
  messageElement.appendChild(mediaContainer);
  messageElement.appendChild(fileInfo);
  messageElement.appendChild(timeElement);

  messages.appendChild(messageElement);

  scrollToBottom();

}

// =========================================
// SYSTEM MESSAGE
// =========================================

function showSystemMessage(message) {

  if (!messages) return;

  const element = document.createElement("div");

  element.className = "system-message";
  element.textContent = message;

  messages.appendChild(element);

  scrollToBottom();

}

// =========================================
// SCROLL TO BOTTOM
// =========================================

function scrollToBottom() {

  if (messages) {
    messages.scrollTop = messages.scrollHeight;
  }

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

  if (typingIndicator) {
    typingIndicator.textContent = "Someone is typing...";
    typingIndicator.style.display = "block";
  }

});

socket.on("user-stop-typing", () => {

  if (typingIndicator) {
    typingIndicator.style.display = "none";
  }

});

// =========================================
// SHARE ROOM
// =========================================

if (shareBtn) {

  shareBtn.addEventListener("click", async () => {

    const roomLink = window.location.origin +
      `/room/${currentRoomId}`;

    try {

      if (navigator.share) {

        await navigator.share({
          title: "Abrari Chat",
          text: "Join my chat room",
          url: roomLink
        });

      } else {

        await navigator.clipboard.writeText(roomLink);

        showAlert("Room link copied!");

      }

    } catch (error) {

      console.log("Share cancelled or failed:", error);

    }

  });

}

// =========================================
// ATTACHMENT MENU
// =========================================

if (attachmentBtn && attachmentMenu) {

  attachmentBtn.addEventListener("click", () => {

    attachmentMenu.classList.toggle("active");

  });

}

// =========================================
// CLOSE ATTACHMENT MENU
// =========================================

document.addEventListener("click", (event) => {

  if (
    attachmentMenu &&
    attachmentBtn &&
    !attachmentMenu.contains(event.target) &&
    !attachmentBtn.contains(event.target)
  ) {

    attachmentMenu.classList.remove("active");

  }

});

// =========================================
// FILE INPUTS
// =========================================

function setupFileInput(inputElement) {

  if (!inputElement) return;

  inputElement.addEventListener("change", (event) => {

    const file = event.target.files?.[0];

    if (file) {
      selectFile(file);
    }

    event.target.value = "";

  });

}

setupFileInput(imageInput);
setupFileInput(videoInput);
setupFileInput(documentInput);
setupFileInput(audioInput);

// =========================================
// SELECT FILE
// =========================================

function selectFile(file) {

  if (file.size > MAX_FILE_SIZE) {

    showAlert("Maximum file size is 25 MB.");
    return;

  }

  selectedFile = file;

  if (attachmentPreview) {
    attachmentPreview.style.display = "flex";
  }

  if (attachmentInfo) {

    attachmentInfo.textContent =
      file.name + " (" + formatFileSize(file.size) + ")";

  }

  if (attachmentMenu) {
    attachmentMenu.classList.remove("active");
  }

}

// =========================================
// REMOVE SELECTED FILE
// =========================================

if (removeAttachmentBtn) {

  removeAttachmentBtn.addEventListener("click", () => {

    selectedFile = null;

    if (attachmentPreview) {
      attachmentPreview.style.display = "none";
    }

  });

}

// =========================================
// SEND SELECTED FILE
// =========================================

async function sendSelectedFile() {

  if (!selectedFile) return;

  if (!socket.connected) {
    showAlert("Please connect to the chat first.");
    return;
  }

  if (!currentRoomId) {
    showAlert("Room not found.");
    return;
  }

  const file = selectedFile;

  const formData = new FormData();

  formData.append("file", file);
  formData.append("roomId", currentRoomId);
  formData.append("username", currentUsername);

  try {

    const sendButton = messageForm?.querySelector(
      'button[type="submit"]'
    );

    if (sendButton) {
      sendButton.disabled = true;
    }

    const response = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      body: formData
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Upload failed");
    }

    selectedFile = null;

    if (attachmentPreview) {
      attachmentPreview.style.display = "none";
    }

    if (messageInput) {
      messageInput.value = "";
    }

  } catch (error) {

    console.error("Media upload error:", error);
    showAlert(error.message);

  } finally {

    const sendButton = messageForm?.querySelector(
      'button[type="submit"]'
    );

    if (sendButton) {
      sendButton.disabled = false;
    }

  }

}

// =========================================
// EMOJI PICKER
// =========================================

if (emojiBtn && emojiPanel) {

  emojiBtn.addEventListener("click", () => {

    emojiPanel.classList.toggle("active");

  });

}

if (emojiPanel) {

  emojiPanel.addEventListener("click", (event) => {

    const target = event.target.closest(
      "[data-emoji], button"
    );

    if (!target) return;

    const emoji =
      target.dataset.emoji || target.textContent.trim();

    if (!emoji || !messageInput) return;

    messageInput.value += emoji;
    messageInput.focus();

  });

}

// =========================================
// VOICE RECORDING
// =========================================

if (voiceBtn) {

  voiceBtn.addEventListener("click", startVoiceRecording);

}

async function startVoiceRecording() {

  if (!navigator.mediaDevices?.getUserMedia) {

    showAlert("Voice recording is not supported in this browser.");
    return;

  }

  try {

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    audioChunks = [];
    cancelRecording = false;
    recordingSeconds = 0;

    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {

      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }

    };

    mediaRecorder.onstop = () => {

      stream.getTracks().forEach(track => track.stop());

      clearInterval(recordingInterval);

      if (!cancelRecording && audioChunks.length > 0) {

        const audioBlob = new Blob(audioChunks, {
          type: mediaRecorder.mimeType || "audio/webm"
        });

        const audioFile = new File(
          [audioBlob],
          "voice-message.webm",
          {
            type: audioBlob.type
          }
        );

        selectFile(audioFile);

      }

      if (recordingPanel) {
        recordingPanel.style.display = "none";
      }

    };

    mediaRecorder.start();

    if (recordingPanel) {
      recordingPanel.style.display = "flex";
    }

    recordingInterval = setInterval(() => {

      recordingSeconds++;

      if (recordingTimer) {

        const minutes = Math.floor(recordingSeconds / 60);
        const seconds = recordingSeconds % 60;

        recordingTimer.textContent =
          `${String(minutes).padStart(2, "0")}:` +
          `${String(seconds).padStart(2, "0")}`;

      }

    }, 1000);

  } catch (error) {

    console.error("Microphone error:", error);

    showAlert("Please allow microphone access.");

  }

}

// =========================================
// STOP RECORDING
// =========================================

if (stopRecordingBtn) {

  stopRecordingBtn.addEventListener("click", () => {

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

  });

}

// =========================================
// CANCEL RECORDING
// =========================================

if (cancelRecordingBtn) {

  cancelRecordingBtn.addEventListener("click", () => {

    cancelRecording = true;

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

  });

}

// =========================================
// AUTO OPEN ROOM FROM URL
// =========================================

async function checkRoomFromURL() {

  const roomId = getRoomId();

  if (!roomId) {
    showHomePage();
    return;
  }

  try {

    const response = await fetch(
      `${API_BASE}/api/rooms/${encodeURIComponent(roomId)}`
    );

    const data = await response.json();

    if (!response.ok || !data.success) {

      showAlert("This room does not exist or has expired.");

      window.history.replaceState({}, "", "/");

      showHomePage();

      return;

    }

    currentRoomId = data.roomId;

    openUsernameModal();

  } catch (error) {

    console.error("Room check error:", error);

    showAlert("Could not connect to the server.");

    showHomePage();

  }

}

// =========================================
// START APPLICATION
// =========================================

showHomePage();

checkRoomFromURL();

console.log("Abrari Chat frontend initialized");
