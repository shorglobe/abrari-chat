const socket = io({
  autoConnect: false
});

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

let currentRoom = "";
let currentUsername = "";
let typingTimer;

// Create room
createRoomBtn.addEventListener("click", async () => {
  try {
    createRoomBtn.disabled = true;

    const response = await fetch("/api/rooms", {
      method: "POST"
    });

    const data = await response.json();

    if (!response.ok) throw new Error("Room creation failed");

    window.location.href = data.link;

  } catch (error) {
    document.getElementById("homeError").textContent =
      "Unable to create room. Try again.";
  } finally {
    createRoomBtn.disabled = false;
  }
});

// Join room using link
joinRoomBtn.addEventListener("click", () => {
  const value = roomLinkInput.value.trim();

  try {
    const url = new URL(value, window.location.origin);
    const match = url.pathname.match(/^\/room\/([a-zA-Z0-9]+)$/);

    if (!match) throw new Error("Invalid link");

    window.location.href = "/room/" + match[1];

  } catch {
    document.getElementById("homeError").textContent =
      "Please enter a valid chat link.";
  }
});

// Read room ID from URL
function getRoomId() {
  const match = window.location.pathname.match(
    /^\/room\/([a-zA-Z0-9]+)$/
  );

  return match ? match[1] : null;
}

// Check current page
async function initialize() {
  currentRoom = getRoomId();

  if (!currentRoom) {
    homePage.classList.remove("hidden");
    return;
  }

  try {
    const response = await fetch("/api/rooms/" + currentRoom);

    if (!response.ok) throw new Error("Room not found");

    homePage.classList.add("hidden");
    chatPage.classList.remove("hidden");
    nameModal.classList.remove("hidden");

  } catch {
    window.location.href = "/";
  }
}

// Enter chat
enterChatBtn.addEventListener("click", () => {
  currentUsername = usernameInput.value.trim().slice(0, 25);

  if (!currentUsername) {
    document.getElementById("nameError").textContent =
      "Please enter your name.";
    return;
  }

  nameModal.classList.add("hidden");

  socket.connect();
});

// Connected
socket.on("connect", () => {
  connectionStatus.textContent = "Online";

  socket.emit("join-room", {
    roomId: currentRoom,
    username: currentUsername
  });
});

socket.on("disconnect", () => {
  connectionStatus.textContent = "Reconnecting...";
});

// New user
socket.on("user-joined", (data) => {
  showSystemMessage(data.username + " joined the chat");
});

// Display message
function displayMessage(data) {
  const isMine = data.senderId === socket.id;

  const messageBox = document.createElement("div");
  messageBox.className = "message " +
    (isMine ? "mine" : "theirs");

  if (!isMine) {
    const name = document.createElement("div");
    name.className = "message-name";
    name.textContent = data.username;

    messageBox.appendChild(name);
  }

  const text = document.createElement("div");
  text.textContent = data.message;

  const time = document.createElement("div");
  time.className = "message-time";

  time.textContent = new Date(data.time).toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" }
  );

  messageBox.appendChild(text);
  messageBox.appendChild(time);

  messages.appendChild(messageBox);

  messages.scrollTop = messages.scrollHeight;
}

// Receive message
socket.on("receive-message", (data) => {
  displayMessage(data);
});

// Send message
messageForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = messageInput.value.trim();

  if (!message || !socket.connected) return;

  socket.emit("send-message", {
    message
  });

  messageInput.value = "";
  socket.emit("stop-typing");
});

// Typing
messageInput.addEventListener("input", () => {
  if (!socket.connected) return;

  socket.emit("typing");

  clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    socket.emit("stop-typing");
  }, 1000);
});

socket.on("user-typing", () => {
  typingIndicator.classList.remove("hidden");
});

socket.on("user-stop-typing", () => {
  typingIndicator.classList.add("hidden");
});

// System message
function showSystemMessage(message) {
  const element = document.createElement("div");

  element.className = "system-message";
  element.textContent = message;

  messages.appendChild(element);
  messages.scrollTop = messages.scrollHeight;
}

// Share room link
shareBtn.addEventListener("click", async () => {
  const link = window.location.href;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Abrari Chat",
        text: "Join my chat room!",
        url: link
      });
    } else {
      await navigator.clipboard.writeText(link);
      shareBtn.innerHTML =
        '<i class="fa-solid fa-check"></i> Copied!';

      setTimeout(() => {
        shareBtn.innerHTML =
          '<i class="fa-solid fa-share-nodes"></i> Share';
      }, 2000);
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      alert("Unable to share link.");
    }
  }
});

initialize();