const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://mcndlovu14_db_user:mcndlovu14_db_user@cluster0.lbcqufp.mongodb.net/soccer_manager?retryWrites=true&w=majority';

console.log('🔄 Connecting to MongoDB...');

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ MongoDB connection successful!');
        console.log('📁 Database: soccer_manager');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:');
        console.error(err.message);
        process.exit(1);
    });