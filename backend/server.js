require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Soccer Manager API running');
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/auth', (req, res) => {
    const { role, password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (role === 'client') {
        return res.json({ success: true, role: 'client' });
    }

    if (role === 'admin' && password === adminPassword) {
        return res.json({ success: true, role: 'admin' });
    }

    return res.status(401).json({
        success: false,
        message: 'Invalid login'
    });
});

app.get('/api/players', (req, res) => {
    db.query('SELECT * FROM players ORDER BY id DESC', (err, results) => {
        if (err) {
            console.log('Players fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch players' });
        }

        res.json(results);
    });
});

app.post('/api/players', (req, res) => {
    const { first_name, last_name, position, age, division } = req.body;

    const query = `
        INSERT INTO players (first_name, last_name, position, age, division)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(query, [first_name, last_name, position, age || null, division], (err, result) => {
        if (err) {
            console.log('Player add error:', err);
            return res.status(500).json({ error: 'Failed to add player' });
        }

        res.json({
            id: result.insertId,
            first_name,
            last_name,
            position,
            age,
            division
        });
    });
});

app.delete('/api/players/:id', (req, res) => {
    db.query('DELETE FROM players WHERE id = ?', [req.params.id], (err) => {
        if (err) {
            console.log('Player delete error:', err);
            return res.status(500).json({ error: 'Failed to delete player' });
        }

        res.json({ message: 'Player deleted' });
    });
});

app.post('/api/attendance/auto', (req, res) => {
    const query = `
        INSERT IGNORE INTO attendance (player_id, attendance_date, status)
        SELECT id, CURDATE(), 'absent' FROM players
    `;

    db.query(query, (err) => {
        if (err) {
            console.log('Attendance auto error:', err);
            return res.status(500).json({ error: 'Failed to create attendance' });
        }

        res.json({ message: 'Attendance created for today' });
    });
});

app.post('/api/attendance/mark', (req, res) => {
    const { player_id, status } = req.body;

    const query = `
        INSERT INTO attendance (player_id, attendance_date, status)
        VALUES (?, CURDATE(), ?)
        ON DUPLICATE KEY UPDATE status = VALUES(status)
    `;

    db.query(query, [player_id, status], (err) => {
        if (err) {
            console.log('Attendance mark error:', err);
            return res.status(500).json({ error: 'Failed to update attendance' });
        }

        res.json({ message: 'Attendance updated' });
    });
});

app.get('/api/attendance', (req, res) => {
    const query = `
        SELECT 
            attendance.id,
            attendance.player_id,
            players.first_name,
            players.last_name,
            attendance.attendance_date,
            attendance.status
        FROM attendance
        JOIN players ON attendance.player_id = players.id
        ORDER BY attendance.attendance_date DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.log('Attendance fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch attendance' });
        }

        res.json(results);
    });
});

app.get('/api/payments', (req, res) => {
    const query = `
        SELECT 
            payments.id,
            payments.player_id,
            players.first_name,
            players.last_name,
            payments.amount,
            payments.status,
            payments.payment_month
        FROM payments
        JOIN players ON payments.player_id = players.id
        ORDER BY payments.id DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.log('Payments fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch payments' });
        }

        res.json(results);
    });
});

app.post('/api/payments/generate', (req, res) => {
    const query = `
        INSERT IGNORE INTO payments (player_id, amount, status, payment_month)
        SELECT id, 70, 'unpaid', DATE_FORMAT(CURDATE(), '%Y-%m') FROM players
    `;

    db.query(query, (err) => {
        if (err) {
            console.log('Payments generate error:', err);
            return res.status(500).json({ error: 'Failed to generate payments' });
        }

        res.json({ message: 'Payment records generated' });
    });
});

app.post('/api/payments/pay', (req, res) => {
    const { player_id } = req.body;

    const query = `
        UPDATE payments
        SET status = 'paid'
        WHERE player_id = ? AND payment_month = DATE_FORMAT(CURDATE(), '%Y-%m')
    `;

    db.query(query, [player_id], (err) => {
        if (err) {
            console.log('Payment update error:', err);
            return res.status(500).json({ error: 'Failed to update payment' });
        }

        res.json({ message: 'Payment marked as paid' });
    });
});

app.get('/api/stats', (req, res) => {
    const query = `
        SELECT 
            player_stats.id,
            player_stats.player_id,
            players.first_name,
            players.last_name,
            player_stats.goals,
            player_stats.assists
        FROM player_stats
        JOIN players ON player_stats.player_id = players.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.log('Stats fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch stats' });
        }

        res.json(results);
    });
});

app.post('/api/stats/update', (req, res) => {
    const { player_id, goals, assists } = req.body;

    const query = `
        INSERT INTO player_stats (player_id, goals, assists)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE goals = VALUES(goals), assists = VALUES(assists)
    `;

    db.query(query, [player_id, goals || 0, assists || 0], (err) => {
        if (err) {
            console.log('Stats update error:', err);
            return res.status(500).json({ error: 'Failed to update stats' });
        }

        res.json({ message: 'Stats updated' });
    });
});

app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
