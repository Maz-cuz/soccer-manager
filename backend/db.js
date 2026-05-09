import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if MONGODB_URI exists
const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env file');
    console.error('Please add: MONGODB_URI=your_mongodb_connection_string');
    process.exit(1);
}

console.log('✅ MONGODB_URI found, connecting...');

const client = new MongoClient(uri);

async function connect() {
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        const db = client.db();
        return db;
    } catch (error) {
        console.error('❌ Connection error:', error.message);
        process.exit(1);
    }
}

export { connect, client };