let data = [];

fetch("/admin/answers")
  .then(res => res.json())
  .then(json => {
    data = json;
    render();
  });

function render() {
  const editor = document.getElementById("editor");
  editor.innerHTML = "";

  data.forEach((item, i) => {
    editor.innerHTML += `
      <hr>
      <p><b>Keywords (comma separated)</b></p>
      <input value="${item.keywords.join(", ")}"
        onchange="data[${i}].keywords = this.value.split(',').map(k => k.trim())">
      <p><b>Answer</b></p>
      <textarea rows="3" cols="50"
        onchange="data[${i}].answer = this.value">${item.answer}</textarea>
    `;
  });
}

function save() {
  fetch("/admin/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(() => alert("Saved successfully"));
}
