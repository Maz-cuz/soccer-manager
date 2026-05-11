require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB Models
const playerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    jersey: { type: String, default: 'N/A' },
    position: { type: String, default: 'N/A' },
    fitness: { type: String, enum: ['fit', 'doubtful', 'unfit'], default: 'fit' },
    attendance: { type: Map, of: String, default: {} },
    payments: { type: Map, of: Boolean, default: {} },
    matchStats: { type: Map, of: Object, default: {} },
    photo: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

const fixtureSchema = new mongoose.Schema({
    opponent: { type: String, required: true },
    date: { type: String, required: true },
    venue: { type: String, enum: ['Home', 'Away'], required: true },
    location: { type: String, default: 'TBD' },
    isCompleted: { type: Boolean, default: false },
    result: {
        homeScore: { type: Number, default: 0 },
        awayScore: { type: Number, default: 0 }
    },
    matchStatsRecorded: { type: Boolean, default: false }
});

const Player = mongoose.model('Player', playerSchema);
const Fixture = mongoose.model('Fixture', fixtureSchema);

// MongoDB Connection - FIXED (removed deprecated options)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/midvaalens_db';

mongoose.connect(MONGODB_URI)
.then(() => console.log('✅ Connected to MongoDB successfully'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Please check your MONGODB_URI in .env file');
});

// ============ PLAYER ROUTES ============
app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find().sort({ createdAt: -1 });
        res.json(players);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/players', async (req, res) => {
    try {
        const player = new Player(req.body);
        await player.save();
        res.status(201).json(player);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/players/:id', async (req, res) => {
    try {
        const player = await Player.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!player) return res.status(404).json({ error: 'Player not found' });
        res.json(player);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/players/:id', async (req, res) => {
    try {
        const player = await Player.findByIdAndDelete(req.params.id);
        if (!player) return res.status(404).json({ error: 'Player not found' });
        res.json({ message: 'Player deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ FIXTURE ROUTES ============
app.get('/api/fixtures', async (req, res) => {
    try {
        const fixtures = await Fixture.find().sort({ date: 1 });
        res.json(fixtures);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/fixtures', async (req, res) => {
    try {
        const fixture = new Fixture(req.body);
        await fixture.save();
        res.status(201).json(fixture);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/fixtures/:id', async (req, res) => {
    try {
        const fixture = await Fixture.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!fixture) return res.status(404).json({ error: 'Fixture not found' });
        res.json(fixture);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/fixtures/:id', async (req, res) => {
    try {
        const fixture = await Fixture.findByIdAndDelete(req.params.id);
        if (!fixture) return res.status(404).json({ error: 'Fixture not found' });
        res.json({ message: 'Fixture deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ AUTH ROUTE ============
app.post('/api/auth', (req, res) => {
    const { role, password } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (role === 'admin') {
        if (password === ADMIN_PASSWORD) {
            res.json({ success: true, role: 'admin' });
        } else {
            res.status(401).json({ success: false, message: 'Wrong password' });
        }
    } else if (role === 'client') {
        res.json({ success: true, role: 'client' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid role' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});
