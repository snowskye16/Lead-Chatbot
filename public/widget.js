(function(){

"use strict";

/* ============================
GET SCRIPT SAFELY (FIXED)
============================ */

let script = document.currentScript;

if (!script) {
  const scripts = document.getElementsByTagName("script");
  script = scripts[scripts.length - 1];
}

if (!script) {
  console.error("SnowSkye: Script not detected");
  return;
}


/* ============================
CONFIG
============================ */

const CONFIG = {

apiKey: script.getAttribute("data-api-key")?.trim(),
brand: script.getAttribute("data-brand") || "Customer Support",
color: script.getAttribute("data-color") || "#0077b6",
logo: script.getAttribute("data-logo") || "",
booking: script.getAttribute("data-booking") || "",
position: script.getAttribute("data-position") || "right"

};

const SERVER = new URL(script.src).origin;

if(!CONFIG.apiKey){
console.error("SnowSkye: Missing API key");
return;
}

const MOBILE = window.innerWidth < 500;


/* ============================
VOICE SYSTEM
============================ */

let voice = null;

function loadVoice(){

const voices = speechSynthesis.getVoices();

voice = voices.find(v =>
v.name.includes("Female") ||
v.name.includes("Samantha") ||
v.name.includes("Zira")
) || voices[0];

}

speechSynthesis.onvoiceschanged = loadVoice;
loadVoice();


function speak(text){

if(!voice) return;

const msg = new SpeechSynthesisUtterance(text);

msg.voice = voice;
msg.rate = 0.95;

speechSynthesis.cancel();
speechSynthesis.speak(msg);

}


/* ============================
CREATE BUTTON
============================ */

const button = document.createElement("div");

button.innerHTML = CONFIG.logo
? `<img src="${CONFIG.logo}" style="width:28px;height:28px;border-radius:50%">`
: "💬";

Object.assign(button.style,{
position:"fixed",
bottom:"20px",
[CONFIG.position]:"20px",
width:"60px",
height:"60px",
borderRadius:"50%",
background:CONFIG.color,
display:"flex",
justifyContent:"center",
alignItems:"center",
color:"#fff",
fontSize:"26px",
cursor:"pointer",
zIndex:"999999",
boxShadow:"0 6px 20px rgba(0,0,0,0.25)"
});

document.body.appendChild(button);


/* ============================
CHAT BOX
============================ */

const chat = document.createElement("div");

Object.assign(chat.style,{
position:"fixed",
bottom:MOBILE?"0":"90px",
[CONFIG.position]:MOBILE?"0":"20px",
width:MOBILE?"100%":"350px",
height:MOBILE?"100%":"500px",
background:"#ffffff",
borderRadius:MOBILE?"0":"14px",
display:"none",
flexDirection:"column",
overflow:"hidden",
zIndex:"999999",
boxShadow:"0 8px 30px rgba(0,0,0,0.2)"
});


/* HEADER */

const header = document.createElement("div");

header.innerHTML = `
<div style="display:flex;align-items:center;gap:10px;">
${CONFIG.logo ? `<img src="${CONFIG.logo}" style="width:32px;height:32px;border-radius:50%">` : ""}
<span style="flex:1">${CONFIG.brand}</span>
<span id="snowClose" style="cursor:pointer;">✕</span>
</div>
`;

Object.assign(header.style,{
background:CONFIG.color,
color:"#fff",
padding:"12px",
fontWeight:"600"
});


/* MESSAGES */

const messages = document.createElement("div");

Object.assign(messages.style,{
flex:"1",
padding:"10px",
overflowY:"auto",
background:"#f7fbff"
});


/* INPUT */

const inputWrap = document.createElement("div");

const inputRow = document.createElement("div");

Object.assign(inputRow.style,{display:"flex"});

const input = document.createElement("input");

input.placeholder="Type message...";

Object.assign(input.style,{
flex:"1",
padding:"12px",
border:"none",
outline:"none"
});

const send = document.createElement("button");

send.innerHTML="Send";

Object.assign(send.style,{
background:CONFIG.color,
color:"#fff",
border:"none",
padding:"12px",
cursor:"pointer"
});

inputRow.appendChild(input);
inputRow.appendChild(send);
inputWrap.appendChild(inputRow);


/* BOOK BUTTON */

if(CONFIG.booking){

const book = document.createElement("button");

book.innerHTML="📅 Book Appointment";

Object.assign(book.style,{
width:"100%",
background:"#28a745",
color:"#fff",
border:"none",
padding:"12px",
cursor:"pointer"
});

book.onclick = ()=> window.open(CONFIG.booking,"_blank");

inputWrap.appendChild(book);

}

chat.appendChild(header);
chat.appendChild(messages);
chat.appendChild(inputWrap);

document.body.appendChild(chat);


/* OPEN CLOSE */

button.onclick=()=> chat.style.display="flex";

header.querySelector("#snowClose").onclick=()=>{
chat.style.display="none";
};


/* ADD MESSAGE */

function add(text,user=false){

const msg=document.createElement("div");

msg.innerText=text;

Object.assign(msg.style,{
padding:"8px",
margin:"6px",
borderRadius:"10px",
maxWidth:"80%",
fontSize:"14px"
});

if(user){
msg.style.background=CONFIG.color;
msg.style.color="#fff";
msg.style.marginLeft="auto";
}else{
msg.style.background="#e9f5ff";
if(text!=="Typing...") speak(text);
}

messages.appendChild(msg);
messages.scrollTop=messages.scrollHeight;

return msg;

}


/* SEND MESSAGE */

async function sendMessage(){

const text=input.value.trim();

if(!text) return;

input.value="";
add(text,true);

const typing=add("Typing...");

try{

const res=await fetch(SERVER+"/chat",{

method:"POST",
headers:{ "Content-Type":"application/json" },

body:JSON.stringify({
apiKey:CONFIG.apiKey,
message:text
})

});

const data=await res.json();

typing.remove();

add(data.reply || "No response.");

}catch{

typing.remove();

add("Server offline.");

}

}

send.onclick=sendMessage;

input.addEventListener("keypress",e=>{
if(e.key==="Enter") sendMessage();
});


/* WELCOME */

setTimeout(()=>{
add("Welcome to "+CONFIG.brand+"! How can we help you?");
},700);

})();
