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

// ============================
// CREATE APP
// ============================

const app = express();
app.set("trust proxy", 1);

// ============================
// SECURITY
// ============================

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));

app.use(compression());

app.use(cors({
  origin: true,
  credentials: true
}));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.json());

// ============================
// STATIC FILES (WIDGET, HTML, IMAGES)
// ============================

app.use(express.static(path.join(__dirname, "public")));

// ============================
// SESSION (RENDER SAFE)
// ============================

app.use(session({

  name: "snowskye-session",

  secret: process.env.SESSION_SECRET || "snowskye_secret",

  resave: false,

  saveUninitialized: false,

  cookie: {

    secure: false, // MUST be false on Render
    httpOnly: true,

    maxAge: 1000 * 60 * 60 * 24 * 7

  }

}));

// ============================
// RATE LIMIT
// ============================

const limiter = rateLimit({

  windowMs: 60 * 1000,
  max: 30,

  message: {
    reply: "Too many requests. Please slow down."
  }

});

app.use("/chat", limiter);

// ============================
// CACHE
// ============================

const cache = new NodeCache({

  stdTTL: 60,
  checkperiod: 120

});

// ============================
// SUPABASE
// ============================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ============================
// OPENAI
// ============================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ============================
// VERIFY API KEY
// ============================

async function verifyApiKey(req, res, next) {

  try {

    const { apiKey } = req.body;

    if (!apiKey)
      return res.status(401).json({
        reply: "Missing API key"
      });

    const { data: client, error } =
      await supabase
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

  }
  catch (err) {

    console.error("API KEY ERROR:", err);

    res.status(500).json({
      reply: "Verification failed"
    });

  }

}

// ============================
// HEALTH CHECK
// ============================

app.get("/", (req, res) => {

  res.json({

    status: "online",
    service: "SnowSkye AI SaaS"

  });

});
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});


// ============================
// CHAT ENDPOINT
// ============================

app.post("/chat", verifyApiKey, async (req, res) => {

  try {

    const { message } = req.body;
    const client = req.client;

    if (!message)
      return res.json({
        reply: "Please enter a message."
      });

    // ============================
    // CACHE CHECK
    // ============================

    const cacheKey = client.id + "_" + message;

    if (cache.has(cacheKey)) {

      return res.json({
        reply: cache.get(cacheKey)
      });

    }

    // ============================
    // LOAD MEMORY
    // ============================

    const { data: history } =
      await supabase
        .from("conversations")
        .select("message, reply")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(5);

    const messages = [

      {
        role: "system",
        content:
          client.ai_prompt ||
          "You are SnowSkye AI assistant helping website visitors professionally."
      }

    ];

    if (history) {

      history.reverse().forEach(item => {

        messages.push({
          role: "user",
          content: item.message
        });

        messages.push({
          role: "assistant",
          content: item.reply
        });

      });

    }

    messages.push({

      role: "user",
      content: message

    });

    // ============================
    // OPENAI REQUEST
    // ============================

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4o-mini",

        messages,

        temperature: 0.7

      });

    const reply =
      completion.choices[0].message.content;

    // ============================
    // SAVE CACHE
    // ============================

    cache.set(cacheKey, reply);

    // ============================
    // SAVE MEMORY
    // ============================

    setImmediate(async () => {

      await supabase
        .from("conversations")
        .insert([{

          client_id: client.id,
          message,
          reply

        }]);

    });

    // ============================
    // AUTO CAPTURE EMAIL LEAD
    // ============================

    if (validator.isEmail(message)) {

      await supabase
        .from("leads")
        .insert([{

          client_id: client.id,
          email: message

        }]);

    }

    // ============================
    // USAGE TRACKING
    // ============================

    await supabase
      .from("usage")
      .insert([{

        client_id: client.id

      }]);

    // ============================
    // RESPONSE
    // ============================

    res.json({
      reply
    });

  }
  catch (err) {

    console.error("CHAT ERROR:", err);

    res.status(500).json({
      reply: "AI temporarily unavailable."
    });

  }

});

// ============================
// REGISTER
// ============================

app.post("/api/register", async (req, res) => {

  try {

    const { email, password } = req.body;

    if (!validator.isEmail(email))
      return res.json({
        success: false,
        error: "Invalid email"
      });

    const hashed =
      await bcrypt.hash(password, 10);

    const apiKey =
      "sk-" + uuidv4();

    await supabase
      .from("clients")
      .insert([{

        email,
        password: hashed,
        api_key: apiKey,
        ai_prompt:
          "You are SnowSkye AI assistant helping website visitors professionally."

      }]);

    res.json({
      success: true,
      apiKey
    });

  }
  catch (err) {

    console.error(err);

    res.json({
      success: false
    });

  }

});

// ============================
// LOGIN
// ============================

// ============================
// LOGIN
// ============================

app.post("/api/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const { data: client } =
      await supabase
        .from("clients")
        .select("*")
        .eq("email", email)
        .single();

    if (!client)
      return res.json({
        success: false
      });

    const valid =
      await bcrypt.compare(
        password,
        client.password
      );

    if (!valid)
      return res.json({
        success: false
      });

    res.json({
      success: true,
      apiKey: client.api_key
    });

  }
  catch {

    res.json({
      success: false
    });

  }

});

// ============================
// SAVE LEAD ENDPOINT
// ============================

app.post("/lead", async (req, res) => {

  try {

    const { apiKey, message, time } = req.body;

    if (!apiKey || !message)
      return res.json({ success:false });

    // find client
    const { data: client } =
      await supabase
        .from("clients")
        .select("*")
        .eq("api_key", apiKey)
        .single();

    if (!client)
      return res.json({ success:false });

    // save lead
    await supabase
      .from("leads")
      .insert([{

        client_id: client.id,
        message: message,
        created_at: time || new Date()

      }]);

    console.log("NEW LEAD SAVED:", message);

    res.json({ success:true });

  }
  catch(err){

    console.error("LEAD SAVE ERROR:", err);

    res.json({ success:false });

  }

});

// ============================
// START SERVER (RENDER SAFE)
// ============================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    "SnowSkye AI running on port",
    PORT
  );

});
