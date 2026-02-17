(function () {

  // ============================
  // CONFIG
  // ============================

  const script = document.currentScript;
  const apiKey = script.getAttribute("data-api-key");

  if (!apiKey) {
    console.error("SnowSkye: Missing API key");
    return;
  }

  const API_URL = "https://lead-chatbot-gti5.onrender.com";

  // ============================
  // WAKE RENDER SERVER
  // ============================

  async function wakeServer(){
    try{
      await fetch(API_URL);
    }catch{}
  }

  wakeServer();


  // ============================
  // SESSION
  // ============================

  let sessionId = localStorage.getItem("snowskye_session");

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("snowskye_session", sessionId);
  }

  let leadCaptured = false;


  // ============================
  // CREATE BUTTON
  // ============================

  const button = document.createElement("div");

  button.innerHTML = "💬";

  Object.assign(button.style, {

    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "60px",
    height: "60px",
    background: "#2563eb",
    color: "white",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    cursor: "pointer",
    zIndex: "999999",
    boxShadow: "0 4px 15px rgba(0,0,0,0.2)"

  });

  document.body.appendChild(button);


  // ============================
  // CHAT BOX
  // ============================

  const box = document.createElement("div");

  Object.assign(box.style, {

    position: "fixed",
    bottom: "90px",
    right: "20px",
    width: "320px",
    height: "450px",
    background: "white",
    borderRadius: "12px",
    boxShadow: "0 5px 25px rgba(0,0,0,0.2)",
    display: "none",
    flexDirection: "column",
    overflow: "hidden",
    zIndex: "999999"

  });

  document.body.appendChild(box);


  // ============================
  // HEADER
  // ============================

  const header = document.createElement("div");

  header.innerHTML = "SnowSkye AI";

  Object.assign(header.style, {

    background: "#2563eb",
    color: "white",
    padding: "12px",
    fontWeight: "bold"

  });

  box.appendChild(header);


  // ============================
  // MESSAGE AREA
  // ============================

  const messages = document.createElement("div");

  Object.assign(messages.style, {

    flex: "1",
    padding: "10px",
    overflowY: "auto",
    background: "#f8fafc"

  });

  box.appendChild(messages);


  // ============================
  // INPUT AREA
  // ============================

  const inputArea = document.createElement("div");

  inputArea.style.display = "flex";

  const input = document.createElement("input");

  input.placeholder = "Type message...";

  Object.assign(input.style, {

    flex: "1",
    padding: "10px",
    border: "none",
    outline: "none"

  });

  const send = document.createElement("button");

  send.innerHTML = "Send";

  Object.assign(send.style, {

    background: "#2563eb",
    color: "white",
    border: "none",
    padding: "10px",
    cursor: "pointer"

  });

  inputArea.appendChild(input);
  inputArea.appendChild(send);

  box.appendChild(inputArea);


  // ============================
  // TOGGLE CHAT
  // ============================

  button.onclick = () => {

    box.style.display =
      box.style.display === "none"
        ? "flex"
        : "none";

    if (box.style.display === "flex"
        && messages.children.length === 0) {

      welcome();

    }

  };


  // ============================
  // ADD MESSAGE
  // ============================

  function addMessage(text, user){

    const div = document.createElement("div");

    div.innerText = text;

    Object.assign(div.style, {

      marginBottom: "10px",
      padding: "8px",
      borderRadius: "8px",
      maxWidth: "80%",
      wordWrap: "break-word"

    });

    if(user){

      div.style.background = "#2563eb";
      div.style.color = "white";
      div.style.marginLeft = "auto";

    }else{

      div.style.background = "#e2e8f0";

    }

    messages.appendChild(div);

    messages.scrollTop = messages.scrollHeight;

  }


  // ============================
  // TYPING INDICATOR
  // ============================

  function typing(){

    removeTyping();

    const div = document.createElement("div");

    div.innerText = "SnowSkye is typing...";

    div.id = "typing";

    div.style.opacity = "0.6";
    div.style.fontStyle = "italic";

    messages.appendChild(div);

  }

  function removeTyping(){

    const t = document.getElementById("typing");

    if(t) t.remove();

  }


  // ============================
  // VOICE CLEANER
  // ============================

  function clean(text){

    return text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,"")
      .replace(/[^\w\s.,!?']/g,"")
      .replace(/\s+/g," ")
      .trim();

  }


  // ============================
  // NATURAL VOICE
  // ============================

  function speak(text){

    try{

      speechSynthesis.cancel();

      const speech =
        new SpeechSynthesisUtterance(
          clean(text)
        );

      const voices =
        speechSynthesis.getVoices();

      const preferred =
        voices.find(v =>
          v.name.includes("Google") ||
          v.name.includes("Natural") ||
          v.lang.includes("en")
        );

      if(preferred)
        speech.voice = preferred;

      speech.rate = 0.92;
      speech.pitch = 1;
      speech.volume = 1;

      speechSynthesis.speak(speech);

    }catch{}

  }


  // ============================
  // LEAD CAPTURE
  // ============================

  function captureLead(){

    if(leadCaptured) return;

    leadCaptured = true;

    setTimeout(()=>{

      addMessage(
        "Before we continue, may I have your name?",
        false
      );

    },2000);

  }


  // ============================
  // WELCOME MESSAGE
  // ============================

  function welcome(){

    const msg =
      "Hello! How can I help you today?";

    addMessage(msg,false);

    speak(msg);

    captureLead();

  }


  // ============================
  // SEND MESSAGE
  // ============================

  async function sendMessage(){

    const text =
      input.value.trim();

    if(!text) return;

    addMessage(text,true);

    input.value="";

    typing();

    try{

      const res =
        await fetch(API_URL + "/chat", {

          method:"POST",

          headers:{
            "Content-Type":
            "application/json"
          },

          body:JSON.stringify({

            apiKey,
            message:text,
            sessionId

          })

        });

      if(!res.ok)
        throw new Error(
          "Server error " + res.status
        );

      const data =
        await res.json();

      removeTyping();

      if(!data || !data.reply){

        addMessage(
          "Sorry, no response received.",
          false
        );

        return;

      }

      addMessage(
        data.reply,
        false
      );

      speak(data.reply);

    }
    catch(err){

      console.error(err);

      removeTyping();

      addMessage(
        "Connection issue. Please try again.",
        false
      );

    }

  }


  // ============================
  // EVENTS
  // ============================

  send.onclick =
    sendMessage;

  input.addEventListener(
    "keypress",
    e=>{
      if(e.key==="Enter")
        sendMessage();
    }
  );

})();
