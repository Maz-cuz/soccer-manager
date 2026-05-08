const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Player = require('../models/Player');
const Fixture = require('../models/Fixture');

// Get all player stats
router.get('/players', auth, async (req, res) => {
    try {
        const players = await Player.find({ userId: req.user.id });
        const fixtures = await Fixture.find({ userId: req.user.id, isCompleted: true });
        
        const stats = players.map(player => {
            let apps = 0, goals = 0, assists = 0, totalRating = 0, ratingCount = 0;
            let yellowCards = 0, redCards = 0;
            
            if (player.matchStats) {
                player.matchStats.forEach((stat) => {
                    apps++;
                    goals += stat.goals || 0;
                    assists += stat.assists || 0;
                    if (stat.rating) {
                        totalRating += stat.rating;
                        ratingCount++;
                    }
                    if (stat.cards === 'yellow') yellowCards++;
                    if (stat.cards === 'red') redCards++;
                });
            }
            
            const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : '-';
            
            return {
                id: player._id,
                name: player.name,
                jersey: player.jersey,
                position: player.position,
                photo: player.photo,
                apps,
                goals,
                assists,
                avgRating,
                yellowCards,
                redCards
            };
        });
        
        // Sort by goals
        stats.sort((a, b) => b.goals - a.goals);
        
        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;