const crypto = require("crypto");

const key = "sk-" + crypto.randomUUID();

console.log("Generated API Key:");
console.log(key);