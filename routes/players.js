const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    jersey: String,
    position: String,
    fitness: {
        type: String,
        enum: ['fit', 'doubtful', 'unfit'],
        default: 'fit'
    },
    photo: String, // base64 string
    attendance: {
        type: Map,
        of: String,
        default: {}
    },
    payments: {
        type: Map,
        of: Boolean,
        default: {}
    },
    matchStats: {
        type: Map,
        of: {
            goals: Number,
            assists: Number,
            rating: Number,
            cards: String
        },
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Player', playerSchema);