const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "chatbot";

if (!uri) {
  console.warn("MONGODB_URI is not set. Please set it in your .env");
}

let cachedClient = global._mongoClient;
let cachedDb = global._mongoDb;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;
  global._mongoClient = client;
  global._mongoDb = db;

  return { client, db };
}

module.exports = { connectToDatabase };
