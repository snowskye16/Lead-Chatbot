console.log("🔥 CLEAN SERVER VERSION LOADED 🔥");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

/* ===============================
   APP SETUP
=============================== */

const app = express();
const PORT = process.env.PORT || 3000;

/* ===============================
   OPENAI SETUP
=============================== */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ===============================
   SUPABASE SETUP
=============================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ===============================
   MIDDLEWARE
=============================== */

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "super-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
    },
  })
);

/* ===============================
   HELPERS
=============================== */

function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

function resetSession(session) {
  session.step = null;
  session.name = null;
}

/* ===============================
   TEST ROUTE
=============================== */

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working 🚀" });
});

/* ===============================
   CHAT ENDPOINT
=============================== */

app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message?.trim();

    if (!message) {
      return res.json({ reply: "Please type a message." });
    }

    /* ===============================
       LEAD CAPTURE FLOW
    =============================== */

    // Step 1 - Trigger quote
    if (!req.session.step && message.toLowerCase().includes("quote")) {
      req.session.step = 1;
      return res.json({ reply: "Great! What's your name?" });
    }

    // Step 2 - Save name
    if (req.session.step === 1) {
      req.session.name = message;
      req.session.step = 2;
      return res.json({ reply: "Nice to meet you! What's your email?" });
    }

    // Step 3 - Save email
    if (req.session.step === 2) {
      const emailInput = message.toLowerCase();

      if (!isValidEmail(emailInput)) {
        return res.json({
          reply: "That doesn't look like a valid email. Please enter a valid email address.",
        });
      }

      const { error } = await supabase.from("leads").insert([
        {
          name: req.session.name,
          email: emailInput,
        },
      ]);

      if (error) {
        console.error("❌ Supabase error:", error);
        return res.json({
          reply: "Something went wrong saving your info. Please try again.",
        });
      }

      resetSession(req.session);

      return res.json({
        reply: "Thanks! We'll contact you shortly 😊",
      });
    }

    /* ===============================
       NORMAL AI RESPONSE (OpenAI)
    =============================== */

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are a helpful AI assistant for a business website. Keep responses professional and concise.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    return res.json({
      reply: response.output_text,
    });

  } catch (error) {
    console.error("❌ Chat error:", error);
    return res.json({
      reply: "Server error. Please try again.",
    });
  }
});

/* ===============================
   START SERVER
=============================== */

app.listen(PORT, () => {
  console.log(`🚀 Lead chatbot running on port ${PORT}`);
});
