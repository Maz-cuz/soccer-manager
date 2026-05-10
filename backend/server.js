const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// In-memory storage (for demo - use PostgreSQL for production)
let players = [];
let fixtures = [];

// Routes
app.get('/api/players', (req, res) => {
    res.json(players);
});

app.post('/api/players', (req, res) => {
    players = req.body;
    res.json({ success: true });
});

app.get('/api/fixtures', (req, res) => {
    res.json(fixtures);
});

app.post('/api/fixtures', (req, res) => {
    fixtures = req.body;
    res.json({ success: true });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});