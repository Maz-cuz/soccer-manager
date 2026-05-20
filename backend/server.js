require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./db');

const app = express();
const uploadsDir = path.join(__dirname, 'uploads');
const photosDir = path.join(uploadsDir, 'photos');
const videosDir = path.join(uploadsDir, 'videos');

[uploadsDir, photosDir, videosDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

const mediaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const mediaType = req.body.media_type === 'video' ? 'videos' : 'photos';
        cb(null, path.join(uploadsDir, mediaType));
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const uploadMedia = multer({
    storage: mediaStorage,
    limits: {
        fileSize: 100 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const isImage = file.mimetype.startsWith('image/');
        const isVideo = file.mimetype.startsWith('video/');

        if (!isImage && !isVideo) {
            cb(new Error('Only image and video files are allowed'));
            return;
        }

        cb(null, true);
    }
});

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

function formatPlayer(player) {
    const attendance = player.attendance_values
        ? String(player.attendance_values).split(',').slice(0, 5)
        : [];

    while (attendance.length < 5) {
        attendance.push(null);
    }

    const firstName = player.first_name || '';
    const lastName = player.last_name || '';

    return {
        ...player,
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        paymentStatus: Number(player.paid) === 1 ? 'paid' : 'unpaid',
        paid: Number(player.paid) === 1,
        attendance
    };
}

app.get('/api/players', (req, res) => {
    const query = `
        SELECT
            players.*,
            (
                SELECT GROUP_CONCAT(attendance.status ORDER BY attendance.attendance_date DESC SEPARATOR ',')
                FROM attendance
                WHERE attendance.player_id = players.id
            ) AS attendance_values,
            (
                SELECT COUNT(*)
                FROM payments
                WHERE payments.player_id = players.id
                  AND payments.payment_month = DATE_FORMAT(CURDATE(), '%Y-%m')
                  AND payments.status = 'paid'
            ) AS paid
        FROM players
        ORDER BY players.id DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.log('Players fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch players' });
        }

        res.json(results.map(formatPlayer));
    });
});

app.post('/api/players', (req, res) => {
    const first_name = req.body.first_name || req.body.firstName || '';
    const last_name = req.body.last_name || req.body.lastName || '';
    const { position, age, division } = req.body;

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
            firstName: first_name,
            lastName: last_name,
            name: `${first_name} ${last_name}`.trim(),
            position,
            age,
            division,
            attendance: [null, null, null, null, null],
            paid: false,
            paymentStatus: 'unpaid'
        });
    });
});

app.put('/api/players/:id', (req, res) => {
    const playerId = req.params.id;
    const updates = [];
    const values = [];

    if (req.body.first_name !== undefined || req.body.firstName !== undefined) {
        updates.push('first_name = ?');
        values.push(req.body.first_name || req.body.firstName || '');
    }

    if (req.body.last_name !== undefined || req.body.lastName !== undefined) {
        updates.push('last_name = ?');
        values.push(req.body.last_name || req.body.lastName || '');
    }

    if (req.body.position !== undefined) {
        updates.push('position = ?');
        values.push(req.body.position);
    }

    if (req.body.age !== undefined) {
        updates.push('age = ?');
        values.push(req.body.age || null);
    }

    if (req.body.division !== undefined) {
        updates.push('division = ?');
        values.push(req.body.division);
    }

    const updatePlayerDetails = (callback) => {
        if (updates.length === 0) {
            callback();
            return;
        }

        values.push(playerId);

        db.query(
            `UPDATE players SET ${updates.join(', ')} WHERE id = ?`,
            values,
            callback
        );
    };

    const updateAttendance = (callback) => {
        if (!Array.isArray(req.body.attendance)) {
            callback();
            return;
        }

        const status = req.body.attendance[0];

        if (status !== 'present' && status !== 'absent') {
            callback();
            return;
        }

        const query = `
            INSERT INTO attendance (player_id, attendance_date, status)
            VALUES (?, CURDATE(), ?)
            ON DUPLICATE KEY UPDATE status = VALUES(status)
        `;

        db.query(query, [playerId, status], callback);
    };

    const updatePayment = (callback) => {
        if (req.body.paid === undefined && req.body.paymentStatus === undefined) {
            callback();
            return;
        }

        const status = req.body.paid === true || req.body.paymentStatus === 'paid'
            ? 'paid'
            : 'unpaid';

        const updateQuery = `
            UPDATE payments
            SET status = ?
            WHERE player_id = ?
              AND payment_month = DATE_FORMAT(CURDATE(), '%Y-%m')
        `;

        db.query(updateQuery, [status, playerId], (updateErr, result) => {
            if (updateErr) {
                callback(updateErr);
                return;
            }

            if (result.affectedRows > 0) {
                callback();
                return;
            }

            const insertQuery = `
                INSERT INTO payments (player_id, amount, status, payment_month)
                VALUES (?, 70, ?, DATE_FORMAT(CURDATE(), '%Y-%m'))
            `;

            db.query(insertQuery, [playerId, status], callback);
        });
    };

    updatePlayerDetails((detailsErr) => {
        if (detailsErr) {
            console.log('Player update error:', detailsErr);
            return res.status(500).json({ error: 'Failed to update player' });
        }

        updateAttendance((attendanceErr) => {
            if (attendanceErr) {
                console.log('Player attendance update error:', attendanceErr);
                return res.status(500).json({ error: 'Failed to update attendance' });
            }

            updatePayment((paymentErr) => {
                if (paymentErr) {
                    console.log('Player payment update error:', paymentErr);
                    return res.status(500).json({ error: 'Failed to update payment' });
                }

                res.json({ message: 'Player updated' });
            });
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

app.get('/api/player-records', (req, res) => {
    const query = `
        SELECT
            players.id AS player_id,
            players.first_name,
            players.last_name,
            players.position,
            COALESCE(SUM(player_match_records.goals), 0) AS goals,
            COALESCE(SUM(player_match_records.clean_sheet), 0) AS clean_sheets,
            COALESCE(SUM(player_match_records.tackles), 0) AS tackles,
            COUNT(player_match_records.id) AS matches_recorded
        FROM players
        LEFT JOIN player_match_records
            ON player_match_records.player_id = players.id
        GROUP BY players.id, players.first_name, players.last_name, players.position
        ORDER BY goals DESC, clean_sheets DESC, tackles DESC, players.first_name ASC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.log('Player records fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch player records' });
        }

        res.json(results);
    });
});

app.post('/api/player-records', (req, res) => {
    const {
        player_id,
        match_date,
        opponent,
        goals,
        clean_sheet,
        tackles,
        role,
        notes
    } = req.body;

    if (!player_id) {
        return res.status(400).json({ error: 'player_id is required' });
    }

    const query = `
        INSERT INTO player_match_records
        (player_id, match_date, opponent, goals, clean_sheet, tackles, role, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        query,
        [
            player_id,
            match_date || null,
            opponent || '',
            Number(goals) || 0,
            clean_sheet ? 1 : 0,
            Number(tackles) || 0,
            role || '',
            notes || ''
        ],
        (err, result) => {
            if (err) {
                console.log('Player record add error:', err);
                return res.status(500).json({ error: 'Failed to add player record' });
            }

            res.json({
                id: result.insertId,
                message: 'Player record added'
            });
        }
    );
});

app.get('/api/player-records/recent', (req, res) => {
    const query = `
        SELECT
            player_match_records.*,
            players.first_name,
            players.last_name,
            players.position
        FROM player_match_records
        JOIN players ON player_match_records.player_id = players.id
        ORDER BY player_match_records.match_date DESC, player_match_records.id DESC
        LIMIT 50
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.log('Recent records fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch recent records' });
        }

        res.json(results);
    });
});

app.get('/api/player-media', (req, res) => {
    const query = `
        SELECT
            player_media.*,
            players.first_name,
            players.last_name
        FROM player_media
        LEFT JOIN players ON player_media.player_id = players.id
        ORDER BY player_media.created_at DESC, player_media.id DESC
        LIMIT 100
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.log('Player media fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch player media' });
        }

        res.json(results);
    });
});

app.post('/api/player-media', uploadMedia.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Media file is required' });
    }

    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'photo';
    const folder = mediaType === 'video' ? 'videos' : 'photos';
    const fileUrl = `/uploads/${folder}/${req.file.filename}`;

    const query = `
        INSERT INTO player_media
        (player_id, title, media_type, file_name, file_url)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        query,
        [
            req.body.player_id || null,
            req.body.title || req.file.originalname,
            mediaType,
            req.file.filename,
            fileUrl
        ],
        (err, result) => {
            if (err) {
                console.log('Player media upload error:', err);
                return res.status(500).json({ error: 'Failed to save media' });
            }

            res.json({
                id: result.insertId,
                media_type: mediaType,
                file_url: fileUrl,
                message: 'Media uploaded'
            });
        }
    );
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
