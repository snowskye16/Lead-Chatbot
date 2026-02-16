require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const path = require("path");

const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

app.use(session({
  secret: "snowskye-secret",
  resave: false,
  saveUninitialized: false
}));

app.use(express.static("public"));


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
// REGISTER
// ============================
app.post("/api/register", async (req, res) => {

  const { email, password } = req.body;

  const { data, error } = await supabase
    .from("users")
    .insert([{
      email,
      password,
      role: "client"
    }])
    .select()
    .single();

  if (error)
    return res.json({ success: false, error: error.message });

  res.json({ success: true });

});


// ============================
// LOGIN
// ============================
app.post("/api/login", async (req, res) => {

  const { email, password } = req.body;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .eq("password", password)
    .single();

  if (error || !data)
    return res.json({ success: false });

  req.session.user = data;

  res.json({
    success: true,
    user: data
  });

});


// ============================
// LOGOUT
// ============================
app.get("/api/logout", (req, res) => {

  req.session.destroy();

  res.json({ success: true });

});


// ============================
// GET LEADS
// ============================
app.get("/api/leads", async (req, res) => {

  const { data } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  res.json(data);

});


// ============================
// ADD LEAD
// ============================
app.post("/api/leads", async (req, res) => {

  const { name, email } = req.body;

  await supabase
    .from("leads")
    .insert([{
      name,
      email
    }]);

  res.json({ success: true });

});


// ============================
// CHATBOT
// ============================
app.post("/chat", async (req, res) => {

  const { message } = req.body;

  const completion =
    await openai.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: "You are SnowSkye AI assistant helping clients and capturing leads."
        },
        {
          role: "user",
          content: message
        }
      ]

    });

  const reply =
    completion.choices[0].message.content;

  res.json({ reply });

}); // ✅ THIS WAS MISSING


// ============================
// SAVE CONVERSATION
// ============================
app.post("/save", async (req,res)=>{

  const {userId,message,reply}=req.body;

  await supabase
    .from("conversations")
    .insert([
      {
        user_id:userId,
        message,
        reply
      }
    ]);

  res.json({success:true});

});


// ============================
app.listen(3000, () => {

  console.log("SnowSkye AI running on port 3000");

});
