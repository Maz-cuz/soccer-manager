const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // For photo base64
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');
const fixtureRoutes = require('./routes/fixtures');
const statsRoutes = require('./routes/stats');
const paymentRoutes = require('./routes/payments');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/fixtures', fixtureRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/payments', paymentRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({ message: '🏆 Midvaalens YD API is running!' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});