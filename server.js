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
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "super-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // true only if using HTTPS
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

function resetSession(sess) {
  sess.step = null;
  sess.name = null;
}

/* ===============================
   AUTH MIDDLEWARE
=============================== */

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.redirect("/login");
  }
  next();
}

/* ===============================
   TEST ROUTE
=============================== */

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working 🚀" });
});

/* ===============================
   LOGIN ROUTES
=============================== */

app.get("/login", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Admin Login</title>
        <style>
          body {
            font-family: Arial;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: #f4f6f9;
          }
          form {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          input {
            width: 100%;
            padding: 10px;
            margin-top: 10px;
            margin-bottom: 20px;
          }
          button {
            padding: 10px 20px;
            background: #2563eb;
            color: white;
            border: none;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <form method="POST" action="/login">
          <h2>Admin Login</h2>
          <input type="password" name="password" placeholder="Enter password" required />
          <button type="submit">Login</button>
        </form>
      </body>
    </html>
  `);
});

app.post("/login", (req, res) => {
  const { password } = req.body;

  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect("/admin");
  }

  res.send("Invalid password");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

/* ===============================
   ADMIN DASHBOARD
=============================== */

app.get("/admin", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = data
      .map(
        (lead) => `
        <tr>
          <td>${lead.name || "-"}</td>
          <td>${lead.email || "-"}</td>
          <td>${new Date(lead.created_at).toLocaleString()}</td>
        </tr>
      `
      )
      .join("");

    res.send(`
      <html>
        <head>
          <title>Admin Dashboard</title>
          <style>
            body { font-family: Arial; padding: 40px; background:#f3f4f6; }
            table { width:100%; border-collapse: collapse; background:white; }
            th, td { padding:12px; border-bottom:1px solid #eee; text-align:left; }
            th { background:#111827; color:white; }
            tr:hover { background:#f9fafb; }
            .logout { margin-bottom:20px; display:inline-block; }
          </style>
        </head>
        <body>
          <a class="logout" href="/logout">Logout</a>
          <h1>AI Leads Dashboard</h1>
          <table>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Date</th>
            </tr>
            ${rows}
          </table>
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
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

    // Lead trigger
    if (!req.session.step && message.toLowerCase().includes("quote")) {
      req.session.step = 1;
      return res.json({ reply: "Great! What's your name?" });
    }

    // Save name
    if (req.session.step === 1) {
      req.session.name = message;
      req.session.step = 2;
      return res.json({ reply: "Nice to meet you! What's your email?" });
    }

    // Save email
    if (req.session.step === 2) {
      if (!isValidEmail(message)) {
        return res.json({
          reply: "That doesn't look like a valid email. Try again.",
        });
      }

      const { error } = await supabase.from("leads").insert([
        {
          name: req.session.name,
          email: message.toLowerCase(),
        },
      ]);

      if (error) throw error;

      resetSession(req.session);

      return res.json({
        reply: "Thanks! We'll contact you shortly 😊",
      });
    }

    // Normal AI reply
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

    res.json({
      reply: response.output_text,
    });

  } catch (error) {
    console.error("❌ Chat error:", error);
    res.json({
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
