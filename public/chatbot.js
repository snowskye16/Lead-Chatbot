(function(){

const apiKey = "CLIENT_API_KEY_HERE";

const box = document.createElement("div");

box.innerHTML = `
<input id="msg">
<button onclick="send()">Send</button>
<div id="chat"></div>
`;

document.body.appendChild(box);

window.send = async function(){

  const message =
  document.getElementById("msg").value;

  const res = await fetch(
  "https://yourdomain.com/chat",{

    method:"POST",

    headers:{
      "Content-Type":"application/json"
    },

    body:JSON.stringify({
      message,
      api_key:apiKey
    })

  });

  const data = await res.json();

  document.getElementById("chat").innerHTML +=
  `<p>Bot: ${data.reply}</p>`;

};

})();
