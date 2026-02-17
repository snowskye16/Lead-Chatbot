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
// CREATE APP FIRST
// ============================

const app = express();


// ============================
// TRUST PROXY (RENDER SAFE)
// ============================

app.set("trust proxy", 1);


// ============================
// SECURITY
// ============================

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(compression());


// ============================
// RATE LIMIT
// ============================

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30
});

app.use("/chat", limiter);


// ============================
// CACHE
// ============================

const cache = new NodeCache({
  stdTTL: 60
});


// ============================
// CORS
// ============================

app.use(cors({
  origin: true,
  credentials: true
}));


app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));


// ============================
// SESSION
// ============================

app.use(session({

  name: "snowskye-session",

  secret: process.env.SESSION_SECRET || "fallback",

  resave: false,

  saveUninitialized: false,

  cookie: {

    secure: true,
    httpOnly: true,
    sameSite: "none",

    maxAge: 1000 * 60 * 60 * 24 * 7

  }

}));


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
// VERIFY API KEY MIDDLEWARE
// ============================

async function verifyApiKey(req, res, next) {

  try {

    const { apiKey } = req.body;

    if (!apiKey)
      return res.status(401).json({
        reply: "Missing API key"
      });

    const { data: client } =
      await supabase
        .from("clients")
        .select("*")
        .eq("api_key", apiKey)
        .single();

    if (!client)
      return res.status(401).json({
        reply: "Invalid API key"
      });

    req.client = client;

    next();

  }
  catch {

    res.status(500).json({
      reply: "Verification failed"
    });

  }

}


// ============================
// HEALTH CHECK
// ============================

app.get("/", (req, res) => {

  res.send("SnowSkye AI SaaS running");

});



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

    req.session.client = {

      id: client.id,
      email: client.email,
      apiKey: client.api_key

    };

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
// CHAT ENDPOINT (UPGRADED)
// ============================

app.post("/chat", verifyApiKey, async (req, res) => {

  try {

    const { message } = req.body;

    const client = req.client;

    if (!message)
      return res.json({
        reply: "Message empty"
      });


    // ============================
    // CACHE CHECK
    // ============================

    const cacheKey =
      client.id + message;

    if (cache.has(cacheKey))
      return res.json({
        reply: cache.get(cacheKey)
      });


    // ============================
    // LOAD MEMORY
    // ============================

    const { data: history } =
      await supabase
        .from("conversations")
        .select("message, reply")
        .eq("client_id", client.id)
        .order("created_at", {
          ascending: false
        })
        .limit(5);


    const messages = [

      {
        role: "system",
        content:
          client.ai_prompt ||
          "You are SnowSkye AI assistant."
      }

    ];


    if (history)
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

        messages

      });


    const reply =
      completion.choices[0].message.content;


    // ============================
    // CACHE RESULT
    // ============================

    cache.set(cacheKey, reply);


    // ============================
    // SAVE CONVERSATION (async)
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
    // AUTO CAPTURE LEAD
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
    // TRACK USAGE
    // ============================

    await supabase
      .from("usage")
      .insert([{

        client_id: client.id

      }]);


    res.json({
      reply
    });

  }
  catch (err) {

  console.error("REGISTER ERROR:", err);

  res.status(500).json({
    success: false,
    error: err.message
  });

}

});
// ============================
// GET CLIENT DATA
// ============================

app.post("/api/register", async (req, res) => {

  try {

    const { email, password } = req.body;

    if (!email || !password)
      return res.json({
        success: false,
        error: "Missing email or password"
      });

    if (!validator.isEmail(email))
      return res.json({
        success: false,
        error: "Invalid email"
      });

    const hashed = await bcrypt.hash(password, 10);

    const apiKey = "sk-" + uuidv4();

    const { data, error } = await supabase
      .from("clients")
      .insert([{
        email,
        password: hashed,
        api_key: apiKey,
        ai_prompt: "You are SnowSkye AI helping customers."
      }])
      .select()
      .single();

    if (error) {

      console.error("SUPABASE ERROR:", error);

      return res.json({
        success: false,
        error: error.message
      });

    }

    res.json({
      success: true,
      apiKey
    });

  }
  catch (err) {

    console.error("REGISTER ERROR:", err);

    res.json({
      success: false,
      error: err.message
    });

  }

});

// ============================
// UPDATE AI PROMPT
// ============================

app.post("/api/update-prompt", async (req, res) => {

  try {

    const { apiKey, ai_prompt } = req.body;

    await supabase
      .from("clients")
      .update({ ai_prompt })
      .eq("api_key", apiKey);

    res.json({ success: true });

  } catch {

    res.json({ success: false });

  }

});


// ============================
// DELETE ACCOUNT
// ============================

app.post("/api/delete-account", async (req, res) => {

  try {

    const { apiKey } = req.body;

    await supabase
      .from("clients")
      .delete()
      .eq("api_key", apiKey);

    res.json({ success: true });

  } catch {

    res.json({ success: false });

  }

});



// ============================
// PORT (RENDER SAFE)
// ============================

const PORT =
  process.env.PORT || 3000;


app.listen(PORT, () => {

  console.log(
    "SnowSkye SaaS running on port",
    PORT
  );

});
