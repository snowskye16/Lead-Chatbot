console.log("🔥 PRODUCTION SERVER LOADED 🔥");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

/* =====================================
   APP SETUP
===================================== */

const app = express();
const PORT = process.env.PORT || 3000;

/* =====================================
   OPENAI
===================================== */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =====================================
   SUPABASE
===================================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* =====================================
   MIDDLEWARE
===================================== */

app.set("trust proxy", 1); // important for Render (HTTPS)

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

/* =====================================
   HELPERS
===================================== */

function isValidEmail(email) {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim().toLowerCase());
}

function resetSession(sess) {
  sess.step = null;
  sess.name = null;
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.isAdmin) {
    return res.redirect("/login");
  }
  next();
}

function escapeCSV(value) {
  if (!value) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
}

/* =====================================
   TEST ROUTE
===================================== */

app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working 🚀" });
});

/* =====================================
   AUTH ROUTES
===================================== */

app.get("/login", (req, res) => {
  res.send(`
    <html>
      <body style="font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh;background:#0f172a;color:white;">
        <form method="POST" action="/login" style="background:#1e293b;padding:40px;border-radius:12px;">
          <h2>Admin Login</h2>
          <input type="password" name="password" placeholder="Password" required 
            style="padding:10px;width:100%;margin:15px 0;border:none;border-radius:6px;">
          <button style="padding:10px 20px;background:#2563eb;border:none;color:white;border-radius:6px;">
            Login
          </button>
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

/* =====================================
   ADMIN ROUTES
===================================== */

// Delete Lead
app.post("/admin/delete/:id", requireAdmin, async (req, res) => {
  try {
    await supabase.from("leads").delete().eq("id", req.params.id);
    res.redirect("/admin");
  } catch (err) {
    console.error("Delete error:", err);
    res.redirect("/admin");
  }
});

// Export CSV
app.get("/admin/export", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const headers = ["Name", "Email", "Date"];

    const rows = data.map(l => [
      escapeCSV(l.name),
      escapeCSV(l.email),
      escapeCSV(new Date(l.created_at).toLocaleString())
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
    res.status(200).send(csv);

  } catch (err) {
    console.error("Export error:", err);
    res.status(500).send("Export failed");
  }
});

// Dashboard
app.get("/admin", requireAdmin, async (req, res) => {
  try {
    const search = req.query.search?.toLowerCase() || "";

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const filtered = data.filter(l =>
      l.name?.toLowerCase().includes(search) ||
      l.email?.toLowerCase().includes(search)
    );

    const rows = filtered.map(l => `
      <tr>
        <td>${l.name || "-"}</td>
        <td>${l.email || "-"}</td>
        <td>${new Date(l.created_at).toLocaleString()}</td>
        <td>
          <form method="POST" action="/admin/delete/${l.id}">
            <button style="background:#ef4444;border:none;color:white;padding:6px 12px;border-radius:6px;cursor:pointer;">
              Delete
            </button>
          </form>
        </td>
      </tr>
    `).join("");

    res.send(`
      <html>
      <head>
        <title>AI Leads Dashboard</title>
        <style>
          body { background:#0f172a;color:#f1f5f9;font-family:Arial;padding:40px; }
          table { width:100%;border-collapse:collapse;background:#1e293b;border-radius:10px;overflow:hidden; }
          th,td { padding:12px;border-bottom:1px solid #334155; }
          th { background:#111827; }
          tr:hover { background:#334155; }
          input { padding:8px;border-radius:6px;border:none; }
          .top { display:flex;justify-content:space-between;margin-bottom:20px; }
          .btn { padding:8px 14px;border-radius:6px;text-decoration:none;color:white; }
          .export { background:#22c55e; }
          .logout { background:#475569; }
        </style>
      </head>
      <body>

        <div class="top">
          <div>
            <h1>AI Leads Dashboard</h1>
            <p>Total Leads: ${filtered.length}</p>
          </div>
          <div>
            <a class="btn export" href="/admin/export">Export CSV</a>
            <a class="btn logout" href="/logout">Logout</a>
          </div>
        </div>

        <form method="GET" action="/admin" style="margin-bottom:20px;">
          <input type="text" name="search" placeholder="Search name or email..." value="${search}">
          <button style="padding:8px 12px;">Search</button>
        </form>

        <table>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
          ${rows || "<tr><td colspan='4'>No leads found</td></tr>"}
        </table>

      </body>
      </html>
    `);

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Dashboard error");
  }
});

/* =====================================
   CHAT
===================================== */

app.post("/chat", async (req, res) => {
  try {
    const message = req.body.message?.trim();
    if (!message) return res.json({ reply: "Please type a message." });

    if (!req.session.step && message.toLowerCase().includes("quote")) {
      req.session.step = 1;
      return res.json({ reply: "Great! What's your name?" });
    }

    if (req.session.step === 1) {
      req.session.name = message;
      req.session.step = 2;
      return res.json({ reply: "Nice to meet you! What's your email?" });
    }

    if (req.session.step === 2) {
      if (!isValidEmail(message)) {
        return res.json({ reply: "Invalid email. Try again." });
      }

      await supabase.from("leads").insert([
        { name: req.session.name, email: message.toLowerCase() }
      ]);

      resetSession(req.session);
      return res.json({ reply: "Thanks! We'll contact you shortly 😊" });
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: "You are a professional business assistant." },
        { role: "user", content: message }
      ],
    });

    res.json({ reply: response.output_text });

  } catch (err) {
    console.error("Chat error:", err);
    res.json({ reply: "Server error. Try again." });
  }
});

/* =====================================
   START SERVER
===================================== */

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
