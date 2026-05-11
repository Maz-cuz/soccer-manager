const { MongoClient } = require('mongodb');

// Your connection string
const uri = "mongodb+srv://mcndlovu14_db_user:mcndlovu14_db_user@cluster0.lbcqufp.mongodb.net/?retryWrites=true&w=majority";

async function test() {
    console.log('Attempting to connect...');
    try {
        const client = new MongoClient(uri);
        await client.connect();
        console.log('✅ CONNECTED SUCCESSFULLY!');
        await client.close();
    } catch (err) {
        console.error('❌ CONNECTION FAILED:', err.message);
        console.error('Full error:', err);
    }
}

test();