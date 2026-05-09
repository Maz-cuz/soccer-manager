import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const client = new MongoClient(process.env.MONGO_URI);

async function connectDB() {
  try {
    await client.connect();
    console.log("MongoDB connected successfully 🔥");
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

connectDB()