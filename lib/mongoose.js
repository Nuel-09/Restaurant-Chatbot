const mongoose = require("mongoose");

const mongoUri = process.env.MONGODB_URI || "";

if (!mongoUri) {
  console.warn("MONGODB_URI is not set. Please set it in your .env");
}

let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection) {
    return cachedConnection;
  }

  const connection = await mongoose.connect(mongoUri);

  cachedConnection = connection;
  return connection;
}

module.exports = { connectToDatabase };
