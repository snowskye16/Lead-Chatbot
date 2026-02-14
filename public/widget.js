(function () {

  if (window.AILeadWidgetLoaded) return;
  window.AILeadWidgetLoaded = true;

  const style = document.createElement("style");
  style.innerHTML = `
    .ai-chat-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #2563eb;
      color: white;
      font-size: 26px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      box-shadow: 0 5px 20px rgba(0,0,0,0.2);
      z-index: 999999;
    }

    .ai-chat-container {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 350px;
      max-width: 95%;
      height: 450px;
      background: white;
      border-radius: 15px;
      box-shadow: 0 15px 40px rgba(0,0,0,0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999998;
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.25s ease;
      pointer-events: none;
      font-family: Arial, sans-serif;
    }

    .ai-chat-container.active {
      opacity: 1;
      transform: translateY(0);
      pointer-events: all;
    }

    .ai-header {
      background: #111827;
      color: white;
      padding: 15px;
      display: flex;
      justify-content: space-between;
      font-weight: bold;
    }

    .ai-box {
      flex: 1;
      padding: 15px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f9fafb;
    }

    .ai-message {
      padding: 10px 14px;
      border-radius: 18px;
      max-width: 75%;
      font-size: 14px;
    }

    .ai-user {
      align-self: flex-end;
      background: #2563eb;
      color: white;
    }

    .ai-bot {
      align-self: flex-start;
      background: #e5e7eb;
      color: black;
    }

    .ai-input {
      display: flex;
      border-top: 1px solid #eee;
    }

    .ai-input input {
      flex: 1;
      border: none;
      padding: 12px;
      outline: none;
    }

    .ai-input button {
      border: none;
      background: #2563eb;
      color: white;
      padding: 0 18px;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  const toggle = document.createElement("div");
  toggle.className = "ai-chat-toggle";
  toggle.innerHTML = "💬";

  const container = document.createElement("div");
  container.className = "ai-chat-container";

  container.innerHTML = `
    <div class="ai-header">
      AI Assistant
      <span style="cursor:pointer;" id="ai-close">✖</span>
    </div>
    <div class="ai-box" id="ai-box"></div>
    <div class="ai-input">
      <input id="ai-input" placeholder="Type your message..." />
      <button id="ai-send">Send</button>
    </div>
  `;

  document.body.appendChild(toggle);
  document.body.appendChild(container);

  toggle.onclick = () => {
    container.classList.toggle("active");
    document.getElementById("ai-input").focus();
  };

  document.getElementById("ai-close").onclick = () => {
    container.classList.remove("active");
  };

  const box = document.getElementById("ai-box");
  const input = document.getElementById("ai-input");

  function addMessage(text, type) {
    const msg = document.createElement("div");
    msg.className = "ai-message " + type;
    msg.innerText = text;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
  }

  async function send() {
    const message = input.value.trim();
    if (!message) return;

    addMessage(message, "ai-user");
    input.value = "";

    const res = await fetch("https://lead-chatbot-gti5.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    addMessage(data.reply || "No response", "ai-bot");
  }

  document.getElementById("ai-send").onclick = send;

  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  });

  addMessage("Hi! 👋 How can I help you?", "ai-bot");

})();
