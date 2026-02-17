(function () {

  // ============================
  // SAFE LOAD
  // ============================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {

    const scriptTag = document.currentScript;

    // ============================
    // CONFIG FROM CLIENT INSTALL
    // ============================

    const apiKey = scriptTag.getAttribute("data-api-key");

    const BRAND =
      scriptTag.getAttribute("data-brand")
      || "Assistant";

    const COLOR =
      scriptTag.getAttribute("data-color")
      || "#2563eb";

    const API_URL =
      "https://lead-chatbot-gti5.onrender.com";

    if (!apiKey) {
      console.error("Missing API key");
      return;
    }

    // ============================
    // WAKE SERVER
    // ============================

    fetch(API_URL + "/health").catch(()=>{});

    // ============================
    // SESSION
    // ============================

    let sessionId =
      localStorage.getItem("snowskye_session");

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(
        "snowskye_session",
        sessionId
      );
    }

    let leadCaptured = false;

    // ============================
    // CREATE BUTTON
    // ============================

    const button =
      document.createElement("div");

    button.innerHTML = "💬";

    Object.assign(button.style, {

      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "60px",
      height: "60px",
      background: COLOR,
      color: "white",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "24px",
      cursor: "pointer",
      zIndex: "999999",
      boxShadow:
        "0 4px 15px rgba(0,0,0,0.2)"

    });

    document.body.appendChild(button);

    // ============================
    // CHAT BOX
    // ============================

    const box =
      document.createElement("div");

    const mobile =
      window.innerWidth < 500;

    Object.assign(box.style, {

      position: "fixed",
      bottom: mobile ? "0" : "90px",
      right: mobile ? "0" : "20px",
      width: mobile ? "100%" : "320px",
      height: mobile ? "100%" : "450px",
      background: "white",
      borderRadius:
        mobile ? "0" : "12px",
      boxShadow:
        "0 5px 25px rgba(0,0,0,0.2)",
      display: "none",
      flexDirection: "column",
      overflow: "hidden",
      zIndex: "999999"

    });

    document.body.appendChild(box);

    // ============================
    // HEADER
    // ============================

    const header =
      document.createElement("div");

    header.innerHTML = BRAND;

    Object.assign(header.style, {

      background: COLOR,
      color: "white",
      padding: "12px",
      fontWeight: "bold"

    });

    box.appendChild(header);

    // ============================
    // MESSAGES AREA
    // ============================

    const messages =
      document.createElement("div");

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

    const inputArea =
      document.createElement("div");

    inputArea.style.display = "flex";

    const input =
      document.createElement("input");

    input.placeholder =
      "Type your message...";

    Object.assign(input.style, {

      flex: "1",
      padding: "10px",
      border: "none",
      outline: "none"

    });

    const send =
      document.createElement("button");

    send.innerHTML = "Send";

    Object.assign(send.style, {

      background: COLOR,
      color: "white",
      border: "none",
      padding: "10px",
      cursor: "pointer"

    });

    inputArea.appendChild(input);
    inputArea.appendChild(send);

    box.appendChild(inputArea);

    // ============================
    // TOGGLE
    // ============================

    button.onclick = () => {

      box.style.display =
        box.style.display === "none"
          ? "flex"
          : "none";

      if (
        box.style.display === "flex"
        && messages.children.length === 0
      ) welcome();

    };

    // ============================
    // MESSAGE FUNCTION
    // ============================

    function addMessage(
      text,
      user = false
    ){

      const div =
        document.createElement("div");

      div.innerText = text;

      Object.assign(div.style, {

        marginBottom: "10px",
        padding: "8px",
        borderRadius: "8px",
        maxWidth: "80%",
        wordWrap: "break-word"

      });

      if(user){

        div.style.background = COLOR;
        div.style.color = "white";
        div.style.marginLeft = "auto";

      }else{

        div.style.background = "#e2e8f0";

      }

      messages.appendChild(div);

      messages.scrollTop =
        messages.scrollHeight;

    }

    // ============================
    // TYPING
    // ============================

    function typing(){

      const div =
        document.createElement("div");

      div.innerText =
        BRAND + " is typing...";

      div.id = "typing";

      div.style.opacity = "0.6";

      messages.appendChild(div);

    }

    function removeTyping(){

      const t =
        document.getElementById("typing");

      if(t) t.remove();

    }

    // ============================
    // VOICE
    // ============================

    function speak(text){

      try{

        speechSynthesis.cancel();

        const speech =
          new SpeechSynthesisUtterance(
            text
          );

        speech.rate = 0.95;

        speechSynthesis.speak(speech);

      }catch{}

    }

    // ============================
    // WELCOME
    // ============================

    function welcome(){

      const msg =
        "Hello! How can I help you today?";

      addMessage(msg);

      speak(msg);

      captureLead();

    }

    // ============================
    // LEAD CAPTURE
    // ============================

    function captureLead(){

      if(leadCaptured) return;

      leadCaptured = true;

      setTimeout(()=>{

        addMessage(
          "May I have your name?"
        );

      },2000);

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
          await fetch(
            API_URL + "/chat",
            {
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
            }
          );

        const data =
          await res.json();

        removeTyping();

        addMessage(
          data.reply
          || "No response"
        );

        speak(data.reply);

      }
      catch{

        removeTyping();

        addMessage(
          "Connection issue."
        );

      }

    }

    send.onclick =
      sendMessage;

    input.addEventListener(
      "keypress",
      e=>{
        if(e.key==="Enter")
          sendMessage();
      }
    );

  }

})();
