(function(){

// create iframe
const iframe = document.createElement("iframe");

iframe.src = "http://localhost:3000/chat.html";

iframe.style.position = "fixed";
iframe.style.bottom = "20px";
iframe.style.right = "20px";
iframe.style.width = "380px";
iframe.style.height = "550px";
iframe.style.border = "none";
iframe.style.zIndex = "999999";
iframe.style.borderRadius = "12px";
iframe.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";

document.body.appendChild(iframe);

})();
