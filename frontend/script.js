
const API_URL = 'https://soccer-manager-61iv.onrender.com/api';

// ========== STATE ==========
let currentRole = null;
let currentSessionDate = new Date().toISOString().split('T')[0];

window.players = [];
window.fixtures = [];

// ========== HELPERS ==========
function canEdit() {
    return currentRole === 'admin';
}

function getPlayerId(player) {
    return player._id || player.id || player.player_id;
}

function getFixtureId(fixture) {
    return fixture._id || fixture.id || fixture.fixture_id;
}

function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data[key])) return data[key];
    return [];
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function clearValue(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
}

// ========== LOGIN ==========
async function login() {
    const role = document.getElementById('roleSelect').value;
    const password = document.getElementById('adminPassword').value;
    const loginError = document.getElementById('loginError');

    if (loginError) loginError.innerText = '';

    // Viewer does not need backend login
    if (role === 'client') {
        currentRole = 'client';

        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';

        const roleText = document.getElementById('roleText');
        if (roleText) roleText.innerText = 'View only mode';

        applyRolePermissions();
        await loadData();
        renderAll();
        return;
    }

    fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, password })
    });

    // Admin uses backend password, for example admin123
    try {
        const res = await fetch(`${API_URL}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, password })
        });

        const data = await res.json();

        console.log('Login response:', data);

        if (!res.ok || !data.success) {
            if (loginError) loginError.innerText = data.message || 'Invalid login';
            return;
        }

        currentRole = data.role || 'admin';

        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';

        const roleText = document.getElementById('roleText');
        if (roleText) roleText.innerText = 'Admin mode';

        applyRolePermissions();
        await loadData();
        renderAll();

    } catch (err) {
        console.error(err);
        if (loginError) loginError.innerText = 'Cannot connect to backend';
    }
}

function logout() {
    currentRole = null;

    const password = document.getElementById('adminPassword');
    if (password) password.value = '';

    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'flex';
}

function applyRolePermissions() {
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = canEdit() ? '' : 'none';
    });
}

// ========== LOAD DATA (MYSQL CONNECTION PRESERVED) ==========
async function loadData() {
    const [playersRes, fixturesRes] = await Promise.all([
        fetch(`${API_URL}/players`),
        fetch(`${API_URL}/fixtures`)
    ]);

    const playersData = await playersRes.json();
    const fixturesData = await fixturesRes.json();

    window.players = normalizeList(playersData, 'players');
    window.fixtures = normalizeList(fixturesData, 'fixtures');
}

// ========== MYSQL UPDATE (KEEP SAME ENDPOINT) ==========
async function updatePlayer(id, data) {
    const res = await fetch(`${API_URL}/players/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    return await res.json();
}

// ========== ATTENDANCE ==========
function getAttendanceArray(player) {
    if (!player.attendance) player.attendance = {};

    if (Array.isArray(player.attendance)) {
        player.attendance = { sessions: player.attendance };
    }

    if (!Array.isArray(player.attendance.sessions)) {
        player.attendance.sessions = [null, null, null, null, null];
    }

    while (player.attendance.sessions.length < 5) {
        player.attendance.sessions.push(null);
    }

    return player.attendance.sessions.slice(0, 5);
}

async function toggleAttendance(playerId, index) {
    if (!canEdit()) return;

    const player = window.players.find(p => String(getPlayerId(p)) === String(playerId));
    if (!player) return;

    const sessions = getAttendanceArray(player);

    if (sessions[index] === null) sessions[index] = 'present';
    else if (sessions[index] === 'present') sessions[index] = 'absent';
    else sessions[index] = null;

    player.attendance.sessions = sessions;

    await updatePlayer(playerId, { attendance: player.attendance });
    renderAll();
}

async function markAllPresent() {
    if (!canEdit()) return;

    for (const player of window.players) {
        const sessions = ['present', 'present', 'present', 'present', 'present'];
        player.attendance = { sessions };
        await updatePlayer(getPlayerId(player), { attendance: player.attendance });
    }

    renderAll();
}

async function clearAttendance() {
    if (!canEdit()) return;

    for (const player of window.players) {
        const sessions = [null, null, null, null, null];
        player.attendance = { sessions };
        await updatePlayer(getPlayerId(player), { attendance: player.attendance });
    }

    renderAll();
}

// ========== PLAYERS ==========
async function addPlayer() {
    if (!canEdit()) return;

    const name =
        document.getElementById('playerName')?.value?.trim() ||
        `${document.getElementById('firstName')?.value || ''} ${document.getElementById('lastName')?.value || ''}`.trim();

    const jersey = document.getElementById('playerJersey')?.value?.trim() || '';
    const position = document.getElementById('playerPosition')?.value?.trim() || document.getElementById('position')?.value?.trim() || '';
    const age = document.getElementById('age')?.value || '';
    const division = document.getElementById('division')?.value?.trim() || '';

    if (!name) return alert('Name required');

    const res = await fetch(`${API_URL}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name,
            jersey,
            position,
            age,
            division,
            paid: false,
            attendance: { sessions: [null, null, null, null, null] }
        })
    });

    const newPlayer = await res.json();

    if (!res.ok) {
        alert(newPlayer.message || 'Could not add player');
        return;
    }

    window.players.push(newPlayer.player || newPlayer);

    clearValue('playerName');
    clearValue('playerJersey');
    clearValue('playerPosition');
    clearValue('firstName');
    clearValue('lastName');
    clearValue('position');
    clearValue('age');
    clearValue('division');

    renderAll();
}

async function deletePlayer(id) {
    if (!canEdit()) return;
    if (!confirm('Delete this player?')) return;

    await fetch(`${API_URL}/players/${id}`, {
        method: 'DELETE'
    });

    window.players = window.players.filter(p => String(getPlayerId(p)) !== String(id));
    renderAll();
}

// ========== PAYMENTS ==========
function isPaid(player) {
    return player.paid === true || player.paymentStatus === 'paid' || player.status === 'paid';
}

async function togglePayment(playerId) {
    if (!canEdit()) return;

    const player = window.players.find(p => String(getPlayerId(p)) === String(playerId));
    if (!player) return;

    const paid = !isPaid(player);

    player.paid = paid;
    player.paymentStatus = paid ? 'paid' : 'unpaid';

    await updatePlayer(playerId, {
        paid,
        paymentStatus: player.paymentStatus
    });

    renderAll();
}

// ========== RENDER PLAYERS ==========
function renderPlayers() {
    const tbody = document.getElementById('playersBody');
    if (!tbody) return;

    if (!window.players.length) {
        tbody.innerHTML = `<tr><td colspan="9">No players found</td></tr>`;
        return;
    }

    tbody.innerHTML = '';

    window.players.forEach(player => {
        const id = getPlayerId(player);
        const sessions = getAttendanceArray(player);
        const row = document.createElement('tr');

        row.innerHTML = `
            <td><strong>${player.name || ''}</strong></td>
            <td>${player.jersey || ''}</td>
            <td>${player.position || ''}</td>
            <td>${player.age || ''}</td>
            <td>${player.division || ''}</td>

            ${sessions.map((s, i) => {
                let icon = '⬜';
                if (s === 'present') icon = '✓';
                if (s === 'absent') icon = '✗';

                return `<td class="${s || ''}" onclick="toggleAttendance('${id}', ${i})">${icon}</td>`;
            }).join('')}

            <td>
                ${canEdit() ? `<button onclick="deletePlayer('${id}')">Delete</button>` : 'View'}
            </td>
        `;

        tbody.appendChild(row);
    });
}

// ========== FIXTURES ==========
async function addFixture() {
    if (!canEdit()) return;

    const opponent = document.getElementById('fixtureOpponent')?.value?.trim();
    const date = document.getElementById('fixtureDate')?.value;
    const venue = document.getElementById('fixtureVenue')?.value?.trim() || 'TBD';
    const location = document.getElementById('fixtureLocation')?.value?.trim() || 'TBD';

    if (!opponent || !date) return alert('Missing fixture fields');

    const res = await fetch(`${API_URL}/fixtures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            opponent,
            date,
            venue,
            location,
            isCompleted: false
        })
    });

    const newFixture = await res.json();

    if (!res.ok) {
        alert(newFixture.message || 'Could not add fixture');
        return;
    }

    window.fixtures.push(newFixture.fixture || newFixture);

    clearValue('fixtureOpponent');
    clearValue('fixtureDate');
    clearValue('fixtureVenue');
    clearValue('fixtureLocation');

    renderFixtures();
}

async function deleteFixture(id) {
    if (!canEdit()) return;
    if (!confirm('Delete this fixture?')) return;

    await fetch(`${API_URL}/fixtures/${id}`, {
        method: 'DELETE'
    });

    window.fixtures = window.fixtures.filter(f => String(getFixtureId(f)) !== String(id));
    renderFixtures();
}

function renderFixtures() {
    const div = document.getElementById('fixturesList');
    if (!div) return;

    if (!window.fixtures.length) {
        div.innerHTML = `<p>No fixtures found</p>`;
        return;
    }

    div.innerHTML = '';

    window.fixtures.forEach(f => {
        const id = getFixtureId(f);

        div.innerHTML += `
            <div class="card">
                <strong>${f.opponent || 'Opponent TBD'}</strong><br>
                📅 ${f.date || ''}<br>
                📍 ${f.venue || f.location || 'TBD'}<br>

                ${canEdit() ? `<button onclick="deleteFixture('${id}')">Delete</button>` : ''}
            </div>
        `;
    });
}

// ========== ATTENDANCE VIEW ==========
function renderAttendance() {
    const tbody = document.getElementById('attendanceBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    window.players.forEach(player => {
        const id = getPlayerId(player);
        const sessions = getAttendanceArray(player);

        tbody.innerHTML += `
            <tr>
                <td><strong>${player.name || ''}</strong></td>
                ${sessions.map((s, i) => {
                    let icon = '⬜';
                    if (s === 'present') icon = '✓';
                    if (s === 'absent') icon = '✗';

                    return `<td class="${s || ''}" onclick="toggleAttendance('${id}', ${i})">${icon}</td>`;
                }).join('')}
            </tr>
        `;
    });
}

// ========== PAYMENTS VIEW ==========
function renderPayments() {
    const tbody = document.getElementById('paymentsBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    window.players.forEach(player => {
        const id = getPlayerId(player);

        tbody.innerHTML += `
            <tr>
                <td>${player.name || ''}</td>
                <td>${isPaid(player) ? 'Paid' : 'Unpaid'}</td>
                <td>
                    ${canEdit() ? `<button onclick="togglePayment('${id}')">${isPaid(player) ? 'Mark unpaid' : 'Mark paid'}</button>` : ''}
                </td>
            </tr>
        `;
    });
}

// ========== STATS VIEW ==========
function renderStats() {
    const tbody = document.getElementById('statsBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    window.players.forEach(player => {
        const sessions = getAttendanceArray(player);
        const present = sessions.filter(s => s === 'present').length;
        const absent = sessions.filter(s => s === 'absent').length;
        const total = present + absent;
        const percentage = total ? Math.round((present / total) * 100) : 0;

        tbody.innerHTML += `
            <tr>
                <td>${player.name || ''}</td>
                <td>${present}</td>
                <td>${absent}</td>
                <td>${percentage}%</td>
            </tr>
        `;
    });
}

// ========== DASHBOARD ==========
function renderDashboard() {
    setText('totalPlayers', window.players.length);

    let present = 0;
    window.players.forEach(p => {
        const sessions = getAttendanceArray(p);
        if (sessions.includes('present')) present++;
    });

    const paid = window.players.filter(isPaid).length;

    setText('presentToday', present);
    setText('paidCount', paid);
}

// ========== MAIN ==========
function renderAll() {
    renderPlayers();
    renderAttendance();
    renderPayments();
    renderStats();
    renderFixtures();
    renderDashboard();
    applyRolePermissions();
}

// ========== TAB SWITCH ==========
function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const tabEl = document.getElementById(tab + 'Tab');
    if (tabEl) tabEl.classList.add('active');

    const button = Array.from(document.querySelectorAll('.tab-btn'))
        .find(btn => btn.getAttribute('onclick')?.includes(`'${tab}'`));

    if (button) button.classList.add('active');
}

// ========== INIT ==========
window.onload = () => {
    console.log('App loaded - MySQL connected via API');

    const mainApp = document.getElementById('mainApp');
    const loginOverlay = document.getElementById('loginOverlay');

    if (mainApp) mainApp.style.display = 'none';
    if (loginOverlay) loginOverlay.style.display = 'flex';
};