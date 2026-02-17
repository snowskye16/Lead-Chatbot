(function () {

const scriptTag = document.currentScript;

const apiKey = scriptTag.getAttribute("data-api-key");
const brand = scriptTag.getAttribute("data-brand") || "Dental Clinic";
const color = scriptTag.getAttribute("data-color") || "#00b4d8";
const server = scriptTag.src.replace("/widget.js","");

if (!apiKey) {
  console.error("Missing API Key");
  return;
}

/* FLOAT BUTTON */
const btn = document.createElement("div");
btn.innerHTML = "🦷";
btn.style.position = "fixed";
btn.style.bottom = "20px";
btn.style.right = "20px";
btn.style.width = "65px";
btn.style.height = "65px";
btn.style.background = "linear-gradient(135deg,#00b4d8,#90e0ef)";
btn.style.color = "white";
btn.style.borderRadius = "50%";
btn.style.display = "flex";
btn.style.alignItems = "center";
btn.style.justifyContent = "center";
btn.style.cursor = "pointer";
btn.style.fontSize = "30px";
btn.style.boxShadow = "0 6px 20px rgba(0,0,0,0.25)";
btn.style.zIndex = "9999";
document.body.appendChild(btn);

/* CHAT BOX */
const box = document.createElement("div");
box.style.position = "fixed";
box.style.bottom = "95px";
box.style.right = "20px";
box.style.width = "340px";
box.style.height = "460px";
box.style.background = "#f8fbff";
box.style.borderRadius = "16px";
box.style.boxShadow = "0 8px 30px rgba(0,0,0,0.25)";
box.style.display = "none";
box.style.flexDirection = "column";
box.style.overflow = "hidden";
box.style.fontFamily = "Arial";
box.style.zIndex = "9999";

/* HEADER */
const header = document.createElement("div");
header.style.background = "linear-gradient(135deg,#00b4d8,#0077b6)";
header.style.color = "white";
header.style.padding = "16px";
header.style.fontSize = "16px";
header.style.fontWeight = "bold";
header.innerHTML = `🦷 ${brand}<br><span style="font-size:12px;font-weight:normal;">Online now • Ready to help</span>`;

/* MESSAGE AREA */
const messages = document.createElement("div");
messages.style.flex = "1";
messages.style.padding = "12px";
messages.style.overflowY = "auto";

/* INPUT AREA */
const inputWrap = document.createElement("div");
inputWrap.style.display = "flex";
inputWrap.style.borderTop = "1px solid #ddd";

const input = document.createElement("input");
input.placeholder = "Ask about appointments, cleaning, etc...";
input.style.flex = "1";
input.style.padding = "12px";
input.style.border = "none";
input.style.outline = "none";

inputWrap.appendChild(input);

/* APPEND */
box.appendChild(header);
box.appendChild(messages);
box.appendChild(inputWrap);
document.body.appendChild(box);

/* TOGGLE */
btn.onclick = () => {
  box.style.display =
    box.style.display === "none" ? "flex" : "none";
};

/* MESSAGE FUNCTION */
function addMessage(text, user=false){

  const msg = document.createElement("div");
  msg.innerText = text;
  msg.style.margin = "8px";
  msg.style.padding = "12px";
  msg.style.borderRadius = "12px";
  msg.style.maxWidth = "80%";
  msg.style.fontSize = "14px";

  if(user){
    msg.style.background = "#0077b6";
    msg.style.color = "white";
    msg.style.marginLeft = "auto";
  } else {
    msg.style.background = "#e3f6fd";
    msg.style.color = "#023e8a";
  }

  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

/* WELCOME MESSAGE */
setTimeout(()=>{
addMessage("Hello! 👋 Welcome to " + brand + ". How can we help you today?");
},500);

/* SEND MESSAGE */
input.addEventListener("keypress", async function(e){

if(e.key !== "Enter") return;

const text = input.value.trim();
if(!text) return;

input.value = "";

addMessage(text,true);

addMessage("Typing...");

try {

const res = await fetch(server + "/chat",{
  method:"POST",
  headers:{
    "Content-Type":"application/json"
  },
  body:JSON.stringify({
    apiKey: apiKey,
    message: text
  })
});

const data = await res.json();

messages.lastChild.remove();

addMessage(data.reply || "Please call our clinic for assistance.");

} catch {
messages.lastChild.remove();
addMessage("Connection error. Please try again.");
}

});

})();
