const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Fixture = require('../models/Fixture');

router.get('/', auth, async (req, res) => {
    try {
        const fixtures = await Fixture.find({ userId: req.user.id }).sort({ date: 1 });
        res.json(fixtures);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const fixture = new Fixture({ ...req.body, userId: req.user.id });
        await fixture.save();
        res.json(fixture);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    try {
        const fixture = await Fixture.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            req.body,
            { new: true }
        );
        res.json(fixture);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        await Fixture.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.json({ message: 'Fixture deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;