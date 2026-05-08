const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Player = require('../models/Player');

// Mark payment for current month
router.put('/:playerId/pay', auth, async (req, res) => {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const player = await Player.findOne({ _id: req.params.playerId, userId: req.user.id });
        
        if (!player) return res.status(404).json({ message: 'Player not found' });
        
        if (!player.payments) player.payments = new Map();
        player.payments.set(currentMonth, true);
        await player.save();
        
        res.json({ message: 'Payment recorded', player });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get payment summary
router.get('/summary', auth, async (req, res) => {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const players = await Player.find({ userId: req.user.id });
        
        let paidCount = 0;
        players.forEach(player => {
            if (player.payments && player.payments.get(currentMonth) === true) {
                paidCount++;
            }
        });
        
        const totalPlayers = players.length;
        const collected = paidCount * 70;
        const outstanding = (totalPlayers - paidCount) * 70;
        
        res.json({
            currentMonth,
            totalPlayers,
            paidCount,
            collected,
            outstanding,
            players: players.map(p => ({
                id: p._id,
                name: p.name,
                photo: p.photo,
                hasPaid: p.payments?.get(currentMonth) === true
            }))
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;