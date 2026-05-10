// routes/payments.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Player = require('../models/Player');

router.get('/summary', auth, async (req, res) => {
    try {
        const players = await Player.find({ userId: req.user.id });
        res.json({ players, total: players.length });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;