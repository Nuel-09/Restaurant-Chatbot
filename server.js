require("dotenv").config();

const path = require("path");
const express = require("express");
const { connectToDatabase } = require("./lib/mongoose");
const chatRoutes = require("./routes/chat");
const paystackRoutes = require("./routes/paystack");

const app = express();
const port = process.env.PORT || 3000;

app.use("/api/paystack/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/chat", chatRoutes);
app.use("/api/paystack", paystackRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function start() {
  try {
    await connectToDatabase();
    app.listen(port, () => {
      console.log(`Express chatbot server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
