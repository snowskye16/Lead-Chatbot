console.log("🔥 SNOWSKYE AI PRODUCTION SERVER LOADED 🔥");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

/* =====================================
   VALIDATION
===================================== */

if (!process.env.OPENAI_API_KEY)
  throw new Error("Missing OPENAI_API_KEY");

if (!process.env.SUPABASE_URL)
  throw new Error("Missing SUPABASE_URL");

if (!process.env.SUPABASE_ANON_KEY)
  throw new Error("Missing SUPABASE_ANON_KEY");

if (!process.env.SESSION_SECRET)
  throw new Error("Missing SESSION_SECRET");

if (!process.env.ADMIN_PASSWORD)
  throw new Error("Missing ADMIN_PASSWORD");

/* =====================================
   SETUP
===================================== */

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  name: "snowskye-ai-session",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24
  }
}));

/* =====================================
   SERVICES
===================================== */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* =====================================
   HELPERS
===================================== */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resetLeadSession(sess) {
  sess.leadStep = null;
  sess.leadData = null;
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin)
    return res.redirect("/login");

  next();
}

/* =====================================
   TEST ROUTE
===================================== */

app.get("/api/test", (req, res) => {
  res.json({
    status: "OK",
    message: "Snowskye AI backend running"
  });
});

/* =====================================
   ADMIN LOGIN
===================================== */

app.get("/login", (req, res) => {

  res.send(`
  <html>
  <body style="font-family:Arial;background:#0f172a;color:white;display:flex;justify-content:center;align-items:center;height:100vh;">

  <form method="POST" action="/login" style="background:#1e293b;padding:40px;border-radius:12px;">

  <h2>Snowskye Admin Login</h2>

  <input
    name="password"
    type="password"
    placeholder="Password"
    style="padding:10px;width:100%;margin:10px 0;border-radius:6px;border:none;"
  />

  <button style="padding:10px;width:100%;background:#2563eb;color:white;border:none;border-radius:6px;">
  Login
  </button>

  </form>

  </body>
  </html>
  `);

});

app.post("/login", (req, res) => {

  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect("/admin");
  }

  res.send("Wrong password");

});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

/* =====================================
   ADMIN DASHBOARD
===================================== */

app.get("/admin", requireAdmin, async (req, res) => {

  const { data } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = data.map(lead => `
    <tr>
      <td>${lead.name || "-"}</td>
      <td>${lead.email || "-"}</td>
      <td>${lead.checkin || "-"}</td>
      <td>${lead.checkout || "-"}</td>
      <td>${lead.guests || "-"}</td>
      <td>${lead.created_at}</td>
    </tr>
  `).join("");

  res.send(`
  <html>
  <body style="background:#0f172a;color:white;font-family:Arial;padding:40px;">

  <h1>Snowskye AI Leads Dashboard</h1>

  <a href="/logout">Logout</a>

  <table border="1" cellpadding="10" style="margin-top:20px;width:100%;">
  <tr>
  <th>Name</th>
  <th>Email</th>
  <th>Checkin</th>
  <th>Checkout</th>
  <th>Guests</th>
  <th>Date</th>
  </tr>

  ${rows}

  </table>

  </body>
  </html>
  `);

});

/* =====================================
   CHATBOT LOGIC
===================================== */

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const userId = req.body.userId || "default";

    if (!userMessage) {
      return res.status(400).json({ reply: "No message provided." });
    }

    // Check if user exists
    let { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Create new lead if not exists
    if (!lead) {
      const { data: newLead } = await supabase
        .from("leads")
        .insert([
          {
            user_id: userId,
            stage: "ask_name",
          },
        ])
        .select()
        .single();

      return res.json({
        reply: "Hi! Welcome 👋 What is your name?",
      });
    }

    // LEAD CAPTURE FLOW
    if (lead.stage === "ask_name") {
      await supabase
        .from("leads")
        .update({
          name: userMessage,
          stage: "ask_phone",
        })
        .eq("user_id", userId);

      return res.json({
        reply: `Nice to meet you, ${userMessage}! What is your phone number?`,
      });
    }

    if (lead.stage === "ask_phone") {
      await supabase
        .from("leads")
        .update({
          phone: userMessage,
          stage: "completed",
        })
        .eq("user_id", userId);

      return res.json({
        reply:
          "Thank you! Our team will contact you shortly. How can I help you today?",
      });
    }

    // NORMAL AI RESPONSE AFTER LEAD CAPTURE
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional AI assistant for a dental clinic. Help users book appointments and answer questions.",
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    const aiReply = completion.choices[0].message.content;

    res.json({
      reply: aiReply,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      reply: "Error processing request.",
    });
  }
});

/* =====================================
   START SERVER
===================================== */

app.listen(PORT, () => {

  console.log("Server running on port", PORT);

});
