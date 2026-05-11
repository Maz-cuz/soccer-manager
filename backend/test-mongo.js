const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const MONGODB_URI = process.env.MONGODB_URI;

console.log('[TEST] Starting MongoDB connection test...');
console.log('[TEST] MONGODB_URI:', MONGODB_URI ? 'Found' : 'NOT FOUND');

if (!MONGODB_URI) {
    console.error('[ERROR] No MONGODB_URI in .env');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('[SUCCESS] ✅ Connected to MongoDB!');
        console.log('[INFO] Connection successful');
        process.exit(0);
    })
    .catch(err => {
        console.error('[ERROR] ❌ Failed:', err.message);
        process.exit(1);
    });