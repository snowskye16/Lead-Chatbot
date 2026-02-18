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

// ============================
// CREATE APP
// ============================

const app = express();
app.set("trust proxy", 1);

// ============================
// SECURITY
// ============================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(compression());

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.json());

// ============================
// STATIC FILES
// ============================

app.use(express.static(path.join(__dirname, "public")));

// ============================
// SESSION
// ============================

app.use(
  session({
    name: "snowskye-session",
    secret: process.env.SESSION_SECRET || "snowskye_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// ============================
// RATE LIMIT
// ============================

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    reply: "Too many requests. Please slow down.",
  },
});

app.use("/chat", limiter);

// ============================
// CACHE
// ============================

const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
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
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================
// EMAIL SYSTEM (FIXED)
// ============================

const transporter = nodemailer.createTransport({

  host: "smtp.gmail.com",
  port: 587,
  secure: false,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  family: 4,

  tls: {
    rejectUnauthorized: false,
  },

});

// Verify email system
transporter.verify(function (error, success) {
  if (error) {
    console.error("Email system failed:", error);
  } else {
    console.log("Email system ready");
  }
});

// ============================
// VERIFY API KEY
// ============================

async function verifyApiKey(req, res, next) {
  try {
    const { apiKey } = req.body;

    if (!apiKey)
      return res.status(401).json({
        reply: "Missing API key",
      });

    const { data: client, error } = await supabase
      .from("clients")
      .select("*")
      .eq("api_key", apiKey)
      .single();

    if (error || !client)
      return res.status(401).json({
        reply: "Invalid API key",
      });

    req.client = client;

    next();
  } catch (err) {
    console.error("API KEY ERROR:", err);

    res.status(500).json({
      reply: "Verification failed",
    });
  }
}

// ============================
// HEALTH CHECK
// ============================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "SnowSkye AI SaaS",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
  });
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
        reply: "Please enter a message.",
      });

    const cacheKey = client.id + "_" + message;

    if (cache.has(cacheKey)) {
      return res.json({
        reply: cache.get(cacheKey),
      });
    }

    const { data: history } = await supabase
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
          "You are SnowSkye AI assistant helping website visitors professionally.",
      },
    ];

    if (history) {
      history.reverse().forEach((item) => {
        messages.push({
          role: "user",
          content: item.message,
        });

        messages.push({
          role: "assistant",
          content: item.reply,
        });
      });
    }

    messages.push({
      role: "user",
      content: message,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;

    cache.set(cacheKey, reply);

    setImmediate(async () => {
      await supabase.from("conversations").insert([
        {
          client_id: client.id,
          message,
          reply,
        },
      ]);
    });

    if (validator.isEmail(message)) {
      await supabase.from("leads").insert([
        {
          client_id: client.id,
          email: message,
        },
      ]);
    }

    await supabase.from("usage").insert([
      {
        client_id: client.id,
      },
    ]);

    res.json({
      reply,
    });
  } catch (err) {
    console.error("CHAT ERROR:", err);

    res.status(500).json({
      reply: "AI temporarily unavailable.",
    });
  }
});

// ============================
// LEAD ENDPOINT
// ============================

app.post("/lead", async (req, res) => {
  try {
    const { apiKey, message, time } = req.body;

    if (!apiKey || !message)
      return res.json({ success: false });

    const { data: client, error } = await supabase
      .from("clients")
      .select("*")
      .eq("api_key", apiKey)
      .single();

    if (error || !client)
      return res.json({ success: false });

    await supabase.from("leads").insert([
      {
        client_id: client.id,
        message,
        created_at: time || new Date(),
      },
    ]);

    try {
      await transporter.sendMail({
        from: `"SnowSkye AI" <${process.env.EMAIL_USER}>`,
        to: client.email,
        subject: "New Website Lead",
        html: `
        <h2>New Lead Received</h2>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
        <p><strong>Time:</strong></p>
        <p>${new Date().toLocaleString()}</p>
        <hr>
        <p>Powered by SnowSkye AI</p>
        `,
      });

      console.log("EMAIL SENT TO:", client.email);
    } catch (emailError) {
      console.error("EMAIL FAILED:", emailError);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("LEAD ERROR:", err);
    res.json({ success: false });
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
      });

    const hashed = await bcrypt.hash(password, 10);

    const apiKey = "sk-" + uuidv4();

    await supabase.from("clients").insert([
      {
        email,
        password: hashed,
        api_key: apiKey,
        ai_prompt:
          "You are SnowSkye AI assistant helping website visitors professionally.",
      },
    ]);

    res.json({
      success: true,
      apiKey,
    });
  } catch {
    res.json({
      success: false,
    });
  }
});

// ============================
// LOGIN
// ============================

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
      apiKey: client.api_key,
    });
  } catch {
    res.json({ success: false });
  }
});

// ============================
// START SERVER
// ============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("SnowSkye AI running on port", PORT);
});
