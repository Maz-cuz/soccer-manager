const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());

/* =========================
   HOME ROUTE
========================= */
app.get('/', (req, res) => {
    res.send('⚽ Soccer League API Running (Render Ready)');
});

/* =========================
   PLAYERS API
========================= */

// Get all players
app.get('/players', (req, res) => {
    db.query('SELECT * FROM players', (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Failed to fetch players' });
        }
        res.json(results);
    });
});

// Add player
app.post('/players', (req, res) => {
    const { first_name, last_name, position, age, division } = req.body;

    const query = `
        INSERT INTO players (first_name, last_name, position, age, division)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(query, [first_name, last_name, position, age, division], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Failed to add player' });
        }
        res.json({ message: 'Player added', id: result.insertId });
    });
});

/* =========================
   ATTENDANCE API
========================= */

// Auto create attendance (all absent today)
app.post('/attendance/auto', (req, res) => {
    const query = `
        INSERT INTO attendance (player_id, attendance_date, status)
        SELECT id, CURDATE(), 'absent' FROM players
    `;

    db.query(query, (err) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Failed to create attendance' });
        }
        res.json({ message: 'Attendance created for today' });
    });
});

// Mark attendance
app.post('/attendance/mark', (req, res) => {
    const { player_id, status } = req.body;

    const query = `
        UPDATE attendance
        SET status = ?
        WHERE player_id = ? AND attendance_date = CURDATE()
    `;

    db.query(query, [status, player_id], (err) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Failed to update attendance' });
        }
        res.json({ message: 'Attendance updated' });
    });
});

// Get attendance
app.get('/attendance', (req, res) => {
    const query = `
        SELECT players.first_name, players.last_name,
               attendance.attendance_date, attendance.status
        FROM attendance
        JOIN players ON attendance.player_id = players.id
        ORDER BY attendance.attendance_date DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Failed to fetch attendance' });
        }
        res.json(results);
    });
});

/* =========================
   PAYMENTS API (R70 SYSTEM)
========================= */

// Get payments
app.get('/payments', (req, res) => {
    db.query('SELECT * FROM payments', (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Failed to fetch payments' });
        }
        res.json(results);
    });
});

// Generate payments
app.post('/payments/generate', (req, res) => {
    const query = `
        INSERT INTO payments (player_id, amount, status)
        SELECT id, 70, 'unpaid' FROM players
    `;

    db.query(query, (err) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Failed to generate payments' });
        }
        res.json({ message: 'Payment records generated' });
    });
});

// Mark as paid
app.post('/payments/pay', (req, res) => {
    const { player_id } = req.body;

    const query = `
        UPDATE payments
        SET status = 'paid'
        WHERE player_id = ?
    `;

    db.query(query, [player_id], (err) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Failed to update payment' });
        }
        res.json({ message: 'Payment marked as paid' });
    });
});

/* =========================
   STATS API
========================= */

// Get stats
app.get('/stats', (req, res) => {
    db.query('SELECT * FROM player_stats', (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Failed to fetch stats' });
        }
        res.json(results);
    });
});

// Update stats
app.post('/stats/update', (req, res) => {
    const { player_id, goals, assists } = req.body;

    const query = `
        UPDATE player_stats
        SET goals = ?, assists = ?
        WHERE player_id = ?
    `;

    db.query(query, [goals, assists, player_id], (err) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Failed to update stats' });
        }
        res.json({ message: 'Stats updated' });
    });
});

/* =========================
   START SERVER (RENDER READY)
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});