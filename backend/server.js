const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   HOME
========================= */
app.get('/', (req, res) => {
    res.send('⚽ Soccer League API Running');
});

/* =========================
   PLAYERS API
========================= */

// GET all players
app.get('/players', (req, res) => {
    db.query('SELECT * FROM players', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ADD player
app.post('/players', (req, res) => {
    const { first_name, last_name, position, age, division } = req.body;

    const query = `
        INSERT INTO players (first_name, last_name, position, age, division)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(query, [first_name, last_name, position, age, division], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Player added', id: result.insertId });
    });
});

/* =========================
   ATTENDANCE API
========================= */

// AUTO create attendance (all absent today)
app.post('/attendance/auto', (req, res) => {
    const query = `
        INSERT INTO attendance (player_id, attendance_date, status)
        SELECT id, CURDATE(), 'absent' FROM players
    `;

    db.query(query, (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Attendance created for today' });
    });
});

// MARK attendance
app.post('/attendance/mark', (req, res) => {
    const { player_id, status } = req.body;

    const query = `
        UPDATE attendance
        SET status = ?
        WHERE player_id = ? AND attendance_date = CURDATE()
    `;

    db.query(query, [status, player_id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Attendance updated' });
    });
});

// GET attendance
app.get('/attendance', (req, res) => {
    const query = `
        SELECT players.first_name, players.last_name,
               attendance.attendance_date, attendance.status
        FROM attendance
        JOIN players ON attendance.player_id = players.id
        ORDER BY attendance.attendance_date DESC
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

/* =========================
   PAYMENTS API (R70 TRACKER)
========================= */

// GET all payments
app.get('/payments', (req, res) => {
    db.query('SELECT * FROM payments', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// CREATE monthly unpaid records
app.post('/payments/generate', (req, res) => {
    const query = `
        INSERT INTO payments (player_id, amount, status)
        SELECT id, 70, 'unpaid' FROM players
    `;

    db.query(query, (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Payment records created' });
    });
});

// MARK payment as paid
app.post('/payments/pay', (req, res) => {
    const { player_id } = req.body;

    const query = `
        UPDATE payments
        SET status = 'paid'
        WHERE player_id = ?
    `;

    db.query(query, [player_id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Player marked as paid' });
    });
});

/* =========================
   STATS API
========================= */

// GET stats
app.get('/stats', (req, res) => {
    db.query('SELECT * FROM player_stats', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// UPDATE stats
app.post('/stats/update', (req, res) => {
    const { player_id, goals, assists } = req.body;

    const query = `
        UPDATE player_stats
        SET goals = ?, assists = ?
        WHERE player_id = ?
    `;

    db.query(query, [goals, assists, player_id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Stats updated' });
    });
});

/* =========================
   SERVER START
========================= */
app.listen(3000, () => {
    console.log('🚀 Soccer API running on http://localhost:3000');
});