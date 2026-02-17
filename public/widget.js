(function(){

const scriptTag = document.currentScript;

const apiKey = scriptTag.getAttribute("data-api-key");
const brand = scriptTag.getAttribute("data-brand") || "Dental Clinic";
const color = scriptTag.getAttribute("data-color") || "#0077b6";

const server = scriptTag.src.replace("/widget.js","");

if(!apiKey) return;

const isMobile = window.innerWidth < 500;

/* FEMALE VOICE */
let femaleVoice = null;

function loadVoice(){

const voices = speechSynthesis.getVoices();

femaleVoice = voices.find(v =>
v.name.includes("Female") ||
v.name.includes("Zira") ||
v.name.includes("Samantha") ||
v.name.includes("Google UK English Female")
) || voices[0];

}

speechSynthesis.onvoiceschanged = loadVoice;
loadVoice();

function speak(text){

const msg = new SpeechSynthesisUtterance(text);

msg.voice = femaleVoice;
msg.rate = 0.95;

speechSynthesis.speak(msg);

}

/* CREATE BUTTON */

const btn = document.createElement("div");

btn.innerHTML = "🦷";

Object.assign(btn.style,{
position:"fixed",
bottom:"20px",
right:"20px",
width:"65px",
height:"65px",
background:"linear-gradient(135deg,#00b4d8,#0077b6)",
borderRadius:"50%",
display:"flex",
justifyContent:"center",
alignItems:"center",
fontSize:"30px",
cursor:"pointer",
zIndex:"9999"
});

document.body.appendChild(btn);

/* CHAT BOX */

const box = document.createElement("div");

Object.assign(box.style,{
position:"fixed",
bottom:isMobile?"0":"100px",
right:isMobile?"0":"20px",
width:isMobile?"100%":"360px",
height:isMobile?"100%":"520px",
background:"#f1f9ff",
borderRadius:isMobile?"0":"16px",
display:"none",
flexDirection:"column",
zIndex:"9999"
});

/* HEADER */

const header = document.createElement("div");

header.innerHTML =
`🦷 ${brand}
<span id="close" style="float:right;cursor:pointer">✕</span>`;

Object.assign(header.style,{
background:"#0077b6",
color:"white",
padding:"15px",
fontWeight:"bold"
});

/* MESSAGES */

const messages = document.createElement("div");

Object.assign(messages.style,{
flex:"1",
padding:"10px",
overflowY:"auto"
});

/* INPUT AREA */

const inputWrap = document.createElement("div");

Object.assign(inputWrap.style,{
display:"flex",
flexDirection:"column"
});

const inputRow = document.createElement("div");

Object.assign(inputRow.style,{
display:"flex"
});

const input = document.createElement("input");

input.placeholder="Ask dental question...";

Object.assign(input.style,{
flex:"1",
padding:"14px",
border:"none"
});

const sendBtn = document.createElement("button");

sendBtn.innerHTML="Send";

Object.assign(sendBtn.style,{
padding:"14px",
background:"#0077b6",
color:"white",
border:"none"
});

/* VOICE BUTTON */

const voiceBtn = document.createElement("button");

voiceBtn.innerHTML="🎤 Talk";

Object.assign(voiceBtn.style,{
padding:"12px",
border:"none",
background:"#00b4d8",
color:"white",
width:"100%"
});

/* BOOK BUTTON */

const bookBtn = document.createElement("button");

bookBtn.innerHTML="📅 Book Appointment";

Object.assign(bookBtn.style,{
padding:"14px",
border:"none",
background:"#28a745",
color:"white",
width:"100%"
});

/* APPEND */

inputRow.appendChild(input);
inputRow.appendChild(sendBtn);

inputWrap.appendChild(inputRow);
inputWrap.appendChild(voiceBtn);
inputWrap.appendChild(bookBtn);

box.appendChild(header);
box.appendChild(messages);
box.appendChild(inputWrap);

document.body.appendChild(box);

/* OPEN CLOSE */

btn.onclick=()=>box.style.display="flex";

header.querySelector("#close").onclick=
()=>box.style.display="none";

/* MESSAGE FUNCTION */

function addMessage(text,user=false){

const msg = document.createElement("div");

msg.innerText=text;

Object.assign(msg.style,{
padding:"10px",
margin:"6px",
borderRadius:"10px",
maxWidth:"80%"
});

if(user){

msg.style.background="#0077b6";
msg.style.color="white";
msg.style.marginLeft="auto";

}else{

msg.style.background="#dff6ff";

speak(text);

}

messages.appendChild(msg);

messages.scrollTop=messages.scrollHeight;

}

/* SAVE LEAD */

async function saveLead(message){

await fetch(server+"/lead",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

apiKey:apiKey,
message:message,
time:new Date()

})

});

}

/* SEND MESSAGE */

async function send(){

const text=input.value.trim();

if(!text) return;

input.value="";

addMessage(text,true);

addMessage("Typing...");

const res=await fetch(server+"/chat",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
apiKey:apiKey,
message:text
})

});

const data=await res.json();

messages.lastChild.remove();

addMessage(data.reply);

saveLead(text);

}

sendBtn.onclick=send;

input.addEventListener("keypress",e=>{
if(e.key==="Enter") send();
});

/* VOICE INPUT */

voiceBtn.onclick=()=>{

const recognition =
new webkitSpeechRecognition();

recognition.lang="en-US";

recognition.start();

recognition.onresult=(e)=>{

input.value=e.results[0][0].transcript;

send();

};

};

/* BOOK BUTTON */

bookBtn.onclick=()=>{

addMessage(
"Booking page opened. Please schedule your dental appointment."
);

window.open(
"https://calendly.com",
"_blank"
);

};

/* WELCOME */

setTimeout(()=>{
addMessage(
"Hello! I'm your dental assistant. You can type or speak to me. How may I help?"
);
},800);

})();
