(function(){

const scriptTag = document.currentScript;

const apiKey = scriptTag.getAttribute("data-api-key");
const brand = scriptTag.getAttribute("data-brand") || "Dental Clinic";
const color = scriptTag.getAttribute("data-color") || "#0077b6";

const server = scriptTag.src.replace("/widget.js","");

if(!apiKey) return;

const isMobile = window.innerWidth < 500;


/* ============================
VOICE SYSTEM
============================ */

let femaleVoice=null;

function loadVoice(){

const voices=speechSynthesis.getVoices();

femaleVoice=voices.find(v=>
v.name.includes("Female") ||
v.name.includes("Zira") ||
v.name.includes("Samantha") ||
v.name.includes("Google UK English Female")
)||voices[0];

}

speechSynthesis.onvoiceschanged=loadVoice;
loadVoice();

function speak(text){

if(!femaleVoice) return;

const msg=new SpeechSynthesisUtterance(text);

msg.voice=femaleVoice;
msg.rate=0.95;

speechSynthesis.cancel();
speechSynthesis.speak(msg);

}


/* ============================
LEAD FLOW STATE
============================ */

let leadStep=0;

let leadData={
name:"",
phone:"",
email:"",
concern:""
};


/* ============================
FLOAT BUTTON
============================ */

const btn=document.createElement("div");

btn.innerHTML="🦷";

Object.assign(btn.style,{
position:"fixed",
bottom:"20px",
right:"20px",
width:"65px",
height:"65px",
background:`linear-gradient(135deg,${color},#023e8a)`,
borderRadius:"50%",
display:"flex",
justifyContent:"center",
alignItems:"center",
fontSize:"30px",
cursor:"pointer",
zIndex:"999999"
});

document.body.appendChild(btn);


/* ============================
CHAT BOX
============================ */

const box=document.createElement("div");

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
zIndex:"999999"
});


/* HEADER */

const header=document.createElement("div");

header.innerHTML=
`${brand}
<span id="close" style="float:right;cursor:pointer">✕</span>`;

Object.assign(header.style,{
background:color,
color:"white",
padding:"15px",
fontWeight:"bold"
});


/* MESSAGE AREA */

const messages=document.createElement("div");

Object.assign(messages.style,{
flex:"1",
padding:"10px",
overflowY:"auto"
});


/* INPUT AREA */

const inputWrap=document.createElement("div");

const inputRow=document.createElement("div");

Object.assign(inputRow.style,{
display:"flex"
});

const input=document.createElement("input");

input.placeholder="Type message...";

Object.assign(input.style,{
flex:"1",
padding:"14px",
border:"none",
outline:"none"
});


const sendBtn=document.createElement("button");

sendBtn.innerHTML="Send";

Object.assign(sendBtn.style,{
padding:"14px",
background:color,
color:"white",
border:"none",
cursor:"pointer"
});


const voiceBtn=document.createElement("button");

voiceBtn.innerHTML="🎤 Talk";

Object.assign(voiceBtn.style,{
padding:"12px",
border:"none",
background:"#00b4d8",
color:"white",
width:"100%"
});


const bookBtn=document.createElement("button");

bookBtn.innerHTML="📅 Book Appointment";

Object.assign(bookBtn.style,{
padding:"14px",
border:"none",
background:"#28a745",
color:"white",
width:"100%"
});


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


/* ============================
ADD MESSAGE
============================ */

function addMessage(text,user=false){

const msg=document.createElement("div");

msg.innerText=text;

Object.assign(msg.style,{
padding:"10px",
margin:"6px",
borderRadius:"10px",
maxWidth:"80%"
});

if(user){

msg.style.background=color;
msg.style.color="white";
msg.style.marginLeft="auto";

}else{

msg.style.background="#dff6ff";

if(text!=="Typing...")
speak(text);

}

messages.appendChild(msg);

messages.scrollTop=messages.scrollHeight;

return msg;

}


/* ============================
SAVE LEAD (SERVER COMPATIBLE)
============================ */

async function saveLead(){

try{

const leadMessage =
"NEW LEAD\n"+
"Name: "+leadData.name+"\n"+
"Phone: "+leadData.phone+"\n"+
"Email: "+leadData.email+"\n"+
"Concern: "+leadData.concern+"\n"+
"Page: "+window.location.href;

await fetch(server+"/lead",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

apiKey:apiKey,
message:leadMessage,
time:new Date().toISOString()

})

});

}catch(e){

console.log("Lead save failed",e);

}

}


/* ============================
SEND FUNCTION
============================ */

async function send(){

const text=input.value.trim();

if(!text) return;

input.value="";

addMessage(text,true);


/* LEAD FLOW */

if(leadStep===0){

leadData.name=text;

leadStep=1;

addMessage("Please enter your phone number:");

return;

}

if(leadStep===1){

leadData.phone=text;

leadStep=2;

addMessage("Please enter your email:");

return;

}

if(leadStep===2){

leadData.email=text;

leadStep=3;

addMessage("What dental service do you need?");

return;

}

if(leadStep===3){

leadData.concern=text;

leadStep=4;

addMessage(
"Thank you! Our clinic will contact you shortly."
);

saveLead();

return;

}


/* NORMAL AI CHAT */

const typing=addMessage("Typing...");

try{

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

typing.remove();

addMessage(data.reply || "Server error.");

}catch{

typing.remove();

addMessage("Server offline.");

}

}


sendBtn.onclick=send;

input.addEventListener("keypress",e=>{
if(e.key==="Enter") send();
});


/* ============================
VOICE INPUT
============================ */

voiceBtn.onclick=()=>{

if(!("webkitSpeechRecognition" in window)){

addMessage("Voice not supported.");
return;

}

const recognition=new webkitSpeechRecognition();

recognition.lang="en-US";

recognition.start();

recognition.onresult=(e)=>{

input.value=e.results[0][0].transcript;

send();

};

};


/* ============================
BOOK BUTTON
============================ */

bookBtn.onclick=()=>{

addMessage("Opening booking page...");

window.open("https://calendly.com","_blank");

};


/* ============================
WELCOME MESSAGE
============================ */

setTimeout(()=>{

addMessage(
"Welcome to "+brand+
"! May I know your name?"
);

},800);


})();
