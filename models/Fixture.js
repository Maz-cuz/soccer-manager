const mongoose = require('mongoose');

const fixtureSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    opponent: {
        type: String,
        required: true
    },
    date: {
        type: String,
        required: true
    },
    venue: {
        type: String,
        enum: ['Home', 'Away'],
        required: true
    },
    location: String,
    isCompleted: {
        type: Boolean,
        default: false
    },
    result: {
        homeScore: Number,
        awayScore: Number
    },
    matchStatsRecorded: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Fixture', fixtureSchema);