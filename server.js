require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const NodeCache = require("node-cache");
const validator = require("validator");
const { v4: uuidv4 } = require("uuid");

const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");

// ===================================
// INIT APP
// ===================================

const app = express();
app.set("trust proxy", 1);

// ===================================
// SECURITY
// ===================================

// ===================================
// SECURITY
// ===================================

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(compression());

app.use(express.json({ limit: "1mb" }));

// ===================================
// STATIC FILES
// ===================================

app.use(express.static(path.join(__dirname, "public")));

// ===================================
// SESSION
// ===================================

app.use(session({
  name: "snowskye-session",
  secret: process.env.SESSION_SECRET || "snowskye_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// ===================================
// RATE LIMIT
// ===================================

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    reply: "Too many requests. Please slow down."
  }
});

app.use("/chat", chatLimiter);

// ===================================
// CACHE
// ===================================

const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120
});

// ===================================
// SUPABASE
// ===================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ===================================
// OPENAI
// ===================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ===================================
// EMAIL SYSTEM
// ===================================

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify(err => {
  if (err) console.log("Email not ready");
  else console.log("Email ready");
});

// ===================================
// VERIFY API KEY
// ===================================

async function verifyApiKey(req, res, next) {

  try {

    const { apiKey } = req.body;

    if (!apiKey)
      return res.status(401).json({
        reply: "Missing API key"
      });

    const { data: client, error } = await supabase
      .from("clients")
      .select("*")
      .eq("api_key", apiKey)
      .single();

    if (error || !client)
      return res.status(401).json({
        reply: "Invalid API key"
      });

    req.client = client;

    next();

  } catch {

    res.status(500).json({
      reply: "Verification failed"
    });

  }

}

// ===================================
// HEALTH
// ===================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "SnowSkye AI"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===================================
// CHAT ENDPOINT
// ===================================

app.post("/chat", verifyApiKey, async (req, res) => {

  try {

    const { message } = req.body;
    const client = req.client;

    if (!message || message.trim() === "")
      return res.json({ reply: "Please enter a message." });

    if (message.length > 1000)
      return res.json({ reply: "Message too long." });

    const cacheKey = client.id + "_" + message.toLowerCase().trim();

    if (cache.has(cacheKey))
      return res.json({
        reply: cache.get(cacheKey)
      });

    // SYSTEM PROMPT

    let systemPrompt = `
You are SnowSkye AI, a professional website assistant.

Goals:
• Help visitors
• Capture leads
• Be friendly and professional
• Encourage contact
`;

    if (client.ai_prompt && client.ai_prompt.length > 10)
      systemPrompt = client.ai_prompt;

    // LOAD HISTORY

    const { data: history } = await supabase
      .from("conversations")
      .select("message, reply")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const messages = [
      { role: "system", content: systemPrompt }
    ];

    if (history) {

      history.reverse().forEach(h => {

        messages.push({
          role: "user",
          content: h.message
        });

        messages.push({
          role: "assistant",
          content: h.reply
        });

      });

    }

    messages.push({
      role: "user",
      content: message
    });

    // OPENAI REQUEST

    const completion = await openai.chat.completions.create({

      model: "gpt-4o-mini",
      messages,
      temperature: 0.7

    });

    const reply = completion.choices[0].message.content;

    cache.set(cacheKey, reply);

    // SAVE CONVERSATION

    await supabase
      .from("conversations")
      .insert([{
        client_id: client.id,
        message,
        reply,
        created_at: new Date().toISOString()
      }]);

    // SAVE LEAD IF EMAIL

    if (validator.isEmail(message)) {

      await supabase
        .from("leads")
        .insert([{
          client_id: client.id,
          email: message,
          created_at: new Date().toISOString()
        }]);

    }

    // TRACK USAGE

    await supabase
      .from("usage")
      .insert([{
        client_id: client.id,
        created_at: new Date().toISOString()
      }]);

    res.json({ reply });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      reply: "AI temporarily unavailable."
    });

  }

});

// ===================================
// REGISTER
// ===================================

app.post("/api/register", async (req, res) => {

  try {

    const { email, password } = req.body;

    if (!validator.isEmail(email))
      return res.json({ success: false });

    const hashed = await bcrypt.hash(password, 10);

    const apiKey = "sk-" + uuidv4();

    await supabase
      .from("clients")
      .insert([{
        email,
        password: hashed,
        api_key: apiKey,
        created_at: new Date().toISOString()
      }]);

    res.json({
      success: true,
      apiKey
    });

  } catch {

    res.json({ success: false });

  }

});

// ===================================
// LOGIN
// ===================================

app.post("/api/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("email", email)
      .single();

    if (!client)
      return res.json({ success: false });

    const valid = await bcrypt.compare(password, client.password);

    if (!valid)
      return res.json({ success: false });

    res.json({
      success: true,
      apiKey: client.api_key
    });

  } catch {

    res.json({ success: false });

  }

});

// ===================================
// START SERVER
// ===================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SnowSkye AI running on port", PORT);
});
