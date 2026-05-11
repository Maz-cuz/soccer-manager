// ========== API CONFIGURATION ==========
// Change this to your backend URL when deployed
const API_URL = 'http://localhost:5000/api'; // For local development
// const API_URL = 'https://your-backend.onrender.com/api'; // For production

// ========== ROLE BASED ACCESS CONTROL ==========
let currentRole = null;
let currentSessionDate = new Date().toISOString().split('T')[0];

// Login handler
async function initLogin() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async function() {
            const selectedRole = document.getElementById('roleSelect').value;
            const enteredPassword = document.getElementById('adminPassword').value;
            
            try {
                const response = await fetch(`${API_URL}/auth`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        role: selectedRole, 
                        password: enteredPassword 
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentRole = data.role;
                    hideLoginAndStartApp();
                } else {
                    alert('Wrong admin password!');
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('Connection error. Please check if backend server is running.');
            }
        });
    }
}

function hideLoginAndStartApp() {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    updateRoleBadge();
    loadData();
}

function logout() {
    currentRole = null;
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('adminPassword').value = '';
    document.getElementById('roleSelect').value = 'admin';
}

function canEdit() {
    return currentRole === 'admin';
}

function updateRoleBadge() {
    const badge = document.getElementById('roleBadge');
    if (badge) {
        if (canEdit()) {
            badge.innerHTML = '👑 Admin Mode - Full Access';
            badge.className = 'role-badge role-admin';
        } else {
            badge.innerHTML = '👁️ Client Mode - View Only';
            badge.className = 'role-badge role-client';
        }
    }
    
    const warning = document.getElementById('readonlyWarning');
    if (warning) {
        warning.style.display = canEdit() ? 'none' : 'block';
    }
    
    const addPlayerCard = document.getElementById('addPlayerCard');
    const addFixtureCard = document.getElementById('addFixtureCard');
    const adminActions = document.getElementById('adminActions');
    
    if (addPlayerCard) addPlayerCard.style.display = canEdit() ? 'block' : 'none';
    if (addFixtureCard) addFixtureCard.style.display = canEdit() ? 'block' : 'none';
    if (adminActions) adminActions.style.display = canEdit() ? 'flex' : 'none';
}

// ========== LOAD/SAVE WITH API ==========
async function loadData() {
    try {
        showLoading();
        const [playersRes, fixturesRes] = await Promise.all([
            fetch(`${API_URL}/players`),
            fetch(`${API_URL}/fixtures`)
        ]);
        
        let players = await playersRes.json();
        let fixtures = await fixturesRes.json();
        
        // Add sample data if empty
        if (players.length === 0) {
            players = await addSamplePlayers();
        }
        
        if (fixtures.length === 0) {
            fixtures = await addSampleFixtures();
        }
        
        window.players = players;
        window.fixtures = fixtures;
        
        render();
        hideLoading();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load data. Make sure backend server is running.');
        hideLoading();
    }
}

async function addSamplePlayers() {
    const samplePlayers = [
        { name: "Thabo Nkosi", jersey: "10", position: "Forward", fitness: "fit", attendance: {}, payments: {}, matchStats: {}, photo: null },
        { name: "Sipho Dlamini", jersey: "5", position: "Defender", fitness: "fit", attendance: {}, payments: {}, matchStats: {}, photo: null },
        { name: "Lerato Molefe", jersey: "7", position: "Midfielder", fitness: "fit", attendance: {}, payments: {}, matchStats: {}, photo: null },
        { name: "Michael Johnson", jersey: "9", position: "Forward", fitness: "fit", attendance: {}, payments: {}, matchStats: {}, photo: null }
    ];
    
    const created = [];
    for (const player of samplePlayers) {
        const response = await fetch(`${API_URL}/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(player)
        });
        const newPlayer = await response.json();
        created.push(newPlayer);
    }
    return created;
}

async function addSampleFixtures() {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const sampleFixtures = [
        { opponent: "Sundowns FC", date: lastWeek.toISOString().split('T')[0], venue: "Home", location: "Midvaal Stadium", isCompleted: true, result: { homeScore: 2, awayScore: 1 }, matchStatsRecorded: true },
        { opponent: "Chiefs United", date: today, venue: "Away", location: "FNB Stadium", isCompleted: false, result: null, matchStatsRecorded: false },
        { opponent: "Pirates Academy", date: nextWeek.toISOString().split('T')[0], venue: "Home", location: "Midvaal Stadium", isCompleted: false, result: null, matchStatsRecorded: false }
    ];
    
    const created = [];
    for (const fixture of sampleFixtures) {
        const response = await fetch(`${API_URL}/fixtures`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fixture)
        });
        const newFixture = await response.json();
        created.push(newFixture);
    }
    return created;
}

// ========== PLAYER CRUD ==========
async function addPlayer(name, jersey, position, photoBase64 = null) {
    if (!canEdit()) { alert('View-only mode. Cannot add players.'); return false; }
    if (!name || !name.trim()) { alert('Player name required!'); return false; }
    
    try {
        const response = await fetch(`${API_URL}/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name.trim(),
                jersey: jersey.trim() || 'N/A',
                position: position.trim() || 'N/A',
                fitness: 'fit',
                attendance: {},
                payments: {},
                matchStats: {},
                photo: photoBase64
            })
        });
        
        const newPlayer = await response.json();
        window.players.push(newPlayer);
        render();
        
        // Clear form inputs
        document.getElementById('playerName').value = '';
        document.getElementById('playerJersey').value = '';
        document.getElementById('playerPosition').value = '';
        if (document.getElementById('playerPhoto')) document.getElementById('playerPhoto').value = '';
        
        return true;
    } catch (error) {
        console.error('Error adding player:', error);
        alert('Failed to add player');
        return false;
    }
}

async function deletePlayer(playerId) {
    if (!canEdit()) { alert('View-only mode. Cannot delete players.'); return; }
    if (confirm('Delete this player?')) {
        try {
            await fetch(`${API_URL}/players/${playerId}`, { method: 'DELETE' });
            window.players = window.players.filter(p => p._id !== playerId);
            render();
        } catch (error) {
            console.error('Error deleting player:', error);
            alert('Failed to delete player');
        }
    }
}

async function editPlayer(playerId, updatedData) {
    if (!canEdit()) return;
    
    try {
        const response = await fetch(`${API_URL}/players/${playerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        
        const updatedPlayer = await response.json();
        const index = window.players.findIndex(p => p._id === playerId);
        if (index !== -1) window.players[index] = updatedPlayer;
        render();
    } catch (error) {
        console.error('Error editing player:', error);
        alert('Failed to edit player');
    }
}

async function updateFitness(playerId, fitness) {
    if (!canEdit()) return;
    await editPlayer(playerId, { fitness });
}

async function markAttendance(playerId, status) {
    if (!canEdit()) { alert('View-only mode. Cannot mark attendance.'); return; }
    
    const player = window.players.find(p => p._id === playerId);
    if (player) {
        if (!player.attendance) player.attendance = {};
        player.attendance[currentSessionDate] = status;
        await editPlayer(playerId, { attendance: player.attendance });
    }
}

async function markAllPresent() {
    if (!canEdit()) { alert('View-only mode.'); return; }
    
    for (const player of window.players) {
        if (!player.attendance) player.attendance = {};
        player.attendance[currentSessionDate] = 'present';
        await editPlayer(player._id, { attendance: player.attendance });
    }
    render();
}

// ========== FIXTURE CRUD ==========
async function addFixture(opponent, date, venue, location) {
    if (!canEdit()) { alert('View-only mode. Cannot add fixtures.'); return; }
    if (!opponent || !date) return alert('Opponent and date required');
    
    try {
        const response = await fetch(`${API_URL}/fixtures`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                opponent,
                date,
                venue,
                location: location || 'TBD',
                isCompleted: false,
                result: null,
                matchStatsRecorded: false
            })
        });
        
        const newFixture = await response.json();
        window.fixtures.push(newFixture);
        window.fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
        renderFixtures();
        
        document.getElementById('fixtureOpponent').value = '';
        document.getElementById('fixtureDate').value = '';
        document.getElementById('fixtureLocation').value = '';
    } catch (error) {
        console.error('Error adding fixture:', error);
        alert('Failed to add fixture');
    }
}

async function deleteFixture(fixtureId) {
    if (!canEdit()) { alert('View-only mode. Cannot delete fixtures.'); return; }
    if (confirm('Delete this fixture?')) {
        try {
            await fetch(`${API_URL}/fixtures/${fixtureId}`, { method: 'DELETE' });
            window.fixtures = window.fixtures.filter(f => f._id !== fixtureId);
            renderFixtures();
            renderStats();
        } catch (error) {
            console.error('Error deleting fixture:', error);
            alert('Failed to delete fixture');
        }
    }
}

async function editFixture(fixtureId, updatedData) {
    if (!canEdit()) return;
    
    try {
        const response = await fetch(`${API_URL}/fixtures/${fixtureId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        
        const updatedFixture = await response.json();
        const index = window.fixtures.findIndex(f => f._id === fixtureId);
        if (index !== -1) window.fixtures[index] = updatedFixture;
        renderFixtures();
    } catch (error) {
        console.error('Error editing fixture:', error);
        alert('Failed to edit fixture');
    }
}

async function recordMatchStats(fixtureId, statsData) {
    if (!canEdit()) { alert('View-only mode. Cannot record stats.'); return; }
    
    for (const [playerId, stats] of Object.entries(statsData)) {
        const player = window.players.find(p => p._id === playerId);
        if (player) {
            if (!player.matchStats) player.matchStats = {};
            player.matchStats[fixtureId] = stats;
            await editPlayer(playerId, { matchStats: player.matchStats });
        }
    }
    
    const fixture = window.fixtures.find(f => f._id === fixtureId);
    if (fixture) {
        await editFixture(fixtureId, { matchStatsRecorded: true });
    }
    
    render();
}

// ========== RENDER FUNCTIONS ==========
function getPlayerSeasonStats(player) {
    let apps = 0, goals = 0, assists = 0, totalRating = 0, ratingCount = 0, cards = { yellow: 0, red: 0 };
    
    if (player.matchStats) {
        Object.values(player.matchStats).forEach(stat => {
            apps++;
            goals += stat.goals || 0;
            assists += stat.assists || 0;
            if (stat.rating) {
                totalRating += stat.rating;
                ratingCount++;
            }
            if (stat.cards === 'yellow') cards.yellow++;
            if (stat.cards === 'red') cards.red++;
        });
    }
    
    const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : '-';
    const cardString = cards.yellow > 0 || cards.red > 0 ? `🟨${cards.yellow} 🟥${cards.red}` : '-';
    
    return { apps, goals, assists, avgRating, cards: cardString };
}

function renderPlayers() {
    const tbody = document.getElementById('playerTableBody');
    if (!tbody || !window.players) return;
    
    const todayPresent = window.players.filter(p => p.attendance?.[currentSessionDate] === 'present').length;
    const fitCount = window.players.filter(p => p.fitness === 'fit').length;
    
    document.getElementById('totalPlayers').innerText = window.players.length;
    document.getElementById('todayAttendance').innerText = todayPresent;
    document.getElementById('fitCount').innerText = fitCount;
    
    tbody.innerHTML = '';
    window.players.forEach(player => {
        const todayStatus = player.attendance?.[currentSessionDate] || 'not marked';
        const last5 = getLast5Attendance(player);
        const historyDisplay = last5.map(s => s === 'present' ? '✅' : s === 'absent' ? '❌' : '⬜').join('');
        
        const row = tbody.insertRow();
        
        const photoCell = row.insertCell(0);
        if (player.photo) {
            const img = document.createElement('img');
            img.src = player.photo;
            img.className = 'player-photo';
            photoCell.appendChild(img);
        } else {
            photoCell.innerHTML = '📸';
        }
        
        row.insertCell(1).innerText = player.name;
        row.insertCell(2).innerText = player.jersey;
        row.insertCell(3).innerText = player.position;
        
        const fitnessCell = row.insertCell(4);
        if (canEdit()) {
            const select = document.createElement('select');
            ['fit', 'doubtful', 'unfit'].forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
                if (player.fitness === opt) option.selected = true;
                select.appendChild(option);
            });
            select.onchange = (e) => updateFitness(player._id, e.target.value);
            fitnessCell.appendChild(select);
        } else {
            fitnessCell.innerHTML = `<span class="fitness-${player.fitness}">${player.fitness}</span>`;
        }
        
        row.insertCell(5).innerHTML = todayStatus === 'present' ? '✅ Present' : todayStatus === 'absent' ? '❌ Absent' : '⚪';
        row.insertCell(6).innerHTML = historyDisplay || '⬜⬜⬜⬜⬜';
        
        const actionCell = row.insertCell(7);
        if (canEdit()) {
            actionCell.innerHTML = `
                <button class="attendance-btn" onclick="markAttendance('${player._id}', 'present')">✅</button>
                <button class="attendance-btn absent" onclick="markAttendance('${player._id}', 'absent')">❌</button>
                <button class="edit-btn" onclick="editPlayerPrompt('${player._id}', '${player.name}')">✏️</button>
                <button class="delete-btn" onclick="deletePlayer('${player._id}')">🗑️</button>
            `;
        } else {
            actionCell.innerHTML = '👁️ Read Only';
        }
    });
}

function getLast5Attendance(player) {
    if (!player.attendance) return [];
    const dates = Object.keys(player.attendance).sort().reverse().slice(0, 5);
    return dates.map(date => player.attendance[date]);
}

function editPlayerPrompt(playerId, currentName) {
    const newName = prompt('Edit player name:', currentName);
    if (newName) editPlayer(playerId, { name: newName });
}

function renderFixtures() {
    const upcomingDiv = document.getElementById('upcomingFixtures');
    const pastDiv = document.getElementById('pastFixtures');
    if (!upcomingDiv || !window.fixtures) return;
    
    const today = new Date().toISOString().split('T')[0];
    const upcoming = window.fixtures.filter(f => !f.isCompleted && f.date >= today);
    const past = window.fixtures.filter(f => f.isCompleted || f.date < today);
    
    upcomingDiv.innerHTML = upcoming.length ? '' : '<p>No upcoming fixtures</p>';
    upcoming.forEach(fixture => {
        upcomingDiv.innerHTML += `
            <div class="fixture-item">
                <div>
                    <strong>${fixture.opponent}</strong><br>
                    📅 ${fixture.date} | ${fixture.venue} at ${fixture.location}
                </div>
                <div class="fixture-actions">
                    ${canEdit() ? `
                        <button class="edit-btn" onclick="editFixturePrompt('${fixture._id}')">✏️ Edit</button>
                        <button class="delete-btn" onclick="deleteFixture('${fixture._id}')">🗑️ Delete</button>
                        <button onclick="openStatsModal('${fixture._id}', '${fixture.opponent}')">📊 Record Stats</button>
                    ` : `
                        <button onclick="openStatsModal('${fixture._id}', '${fixture.opponent}')">👁️ View Stats</button>
                    `}
                </div>
            </div>
        `;
    });
    
    pastDiv.innerHTML = past.length ? '' : '<p>No past fixtures</p>';
    past.forEach(fixture => {
        const resultText = fixture.result ? `${fixture.result.homeScore} - ${fixture.result.awayScore}` : 'No result';
        pastDiv.innerHTML += `
            <div class="fixture-item completed">
                <div>
                    <strong>${fixture.opponent}</strong><br>
                    📅 ${fixture.date} | ${fixture.venue}<br>
                    🏆 Result: ${resultText}
                </div>
                <div class="fixture-actions">
                    ${canEdit() && !fixture.matchStatsRecorded ? `<button onclick="openStatsModal('${fixture._id}', '${fixture.opponent}')">📊 Record Stats</button>` : ''}
                    ${canEdit() ? `<button class="delete-btn" onclick="deleteFixture('${fixture._id}')">🗑️ Delete</button>` : ''}
                </div>
            </div>
        `;
    });
    
    const select = document.getElementById('reportFixtureSelect');
    if (select) {
        select.innerHTML = '<option value="">Select fixture...</option>';
        [...upcoming, ...past].forEach(fixture => {
            select.innerHTML += `<option value="${fixture._id}">${fixture.opponent} (${fixture.date})</option>`;
        });
    }
}

function editFixturePrompt(fixtureId) {
    if (!canEdit()) return;
    
    const fixture = window.fixtures.find(f => f._id === fixtureId);
    if (!fixture) return;
    
    const newOpponent = prompt('Opponent:', fixture.opponent);
    const newDate = prompt('Date (YYYY-MM-DD):', fixture.date);
    const newVenue = prompt('Venue (Home/Away):', fixture.venue);
    const newLocation = prompt('Location:', fixture.location);
    
    if (newOpponent && newDate) {
        editFixture(fixtureId, {
            opponent: newOpponent,
            date: newDate,
            venue: newVenue,
            location: newLocation
        });
    }
}

function renderStats() {
    const tbody = document.getElementById('statsTableBody');
    if (!tbody || !window.players) return;
    
    let topScorer = { name: '', goals: 0 };
    let topRated = { name: '', rating: 0 };
    let totalGoals = 0;
    
    tbody.innerHTML = '';
    window.players.forEach(player => {
        const stats = getPlayerSeasonStats(player);
        totalGoals += stats.goals;
        if (stats.goals > topScorer.goals) topScorer = { name: player.name, goals: stats.goals };
        if (stats.avgRating !== '-' && parseFloat(stats.avgRating) > topRated.rating) topRated = { name: player.name, rating: parseFloat(stats.avgRating) };
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${player.name}</strong> ${player.photo ? '📸' : ''}</td>
            <td>${stats.apps}</td>
            <td>⭐ ${stats.goals}</td>
            <td>🎯 ${stats.assists}</td>
            <td>${stats.avgRating}</td>
            <td>${stats.cards}</td>
        `;
    });
    
    document.getElementById('topScorer').innerHTML = `${topScorer.name || '- '}<br><small>${topScorer.goals} goals</small>`;
    document.getElementById('topRated').innerHTML = `${topRated.name || '- '}<br><small>${topRated.rating} avg</small>`;
    document.getElementById('totalGoals').innerText = totalGoals;
}

function renderPayments() {
    const monthSpan = document.getElementById('paymentMonth');
    const summaryDiv = document.getElementById('paymentsSummary');
    const paymentsList = document.getElementById('paymentsList');
    if (!monthSpan || !window.players) return;
    
    const currentMonth = getCurrentMonth();
    monthSpan.innerText = currentMonth;
    const paidCount = window.players.filter(p => hasPaidCurrentMonth(p)).length;
    const collected = paidCount * 70;
    const outstanding = (window.players.length - paidCount) * 70;
    
    summaryDiv.innerHTML = `<strong>💰 R${collected}</strong> collected | <strong>⚠️ R${outstanding}</strong> outstanding | 📊 ${paidCount}/${window.players.length} players paid`;
    
    let html = '<table style="width:100%"><thead><tr><th>Player</th><th>Photo</th><th>Status</th><th>Action</th></tr></thead><tbody>';
    window.players.forEach(player => {
        const paid = hasPaidCurrentMonth(player);
        html += `
            <tr>
                <td>${player.name}</td>
                <td>${player.photo ? '<img src="'+player.photo+'" class="player-photo" style="width:30px;height:30px;border-radius:50%;object-fit:cover">' : '📸'}</td>
                <td>${paid ? '✅ Paid R70' : '❌ Unpaid'}</td>
                <td>${!paid && canEdit() ? `<button class="pay-btn" onclick="markPayment('${player._id}')">💰 Pay R70</button>` : (paid ? '✔️ Done' : '🔒 View Only')}</td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    paymentsList.innerHTML = html;
}

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function hasPaidCurrentMonth(player) {
    return player.payments && player.payments[getCurrentMonth()] === true;
}

async function markPayment(playerId) {
    if (!canEdit()) { alert('View-only mode. Cannot record payments.'); return; }
    
    const player = window.players.find(p => p._id === playerId);
    if (player) {
        if (!player.payments) player.payments = {};
        player.payments[getCurrentMonth()] = true;
        await editPlayer(playerId, { payments: player.payments });
        renderPayments();
    }
}

function render() {
    renderPlayers();
    renderFixtures();
    renderStats();
    renderPayments();
}

// ========== LOADING INDICATOR ==========
function showLoading() {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        color: white;
        font-size: 1.5rem;
    `;
    overlay.innerHTML = '<div>Loading data... ⚽</div>';
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.remove();
}

// ========== MODAL FUNCTIONS ==========
let currentFixtureId = null;

window.openStatsModal = function(fixtureId, opponent) {
    currentFixtureId = fixtureId;
    document.getElementById('modalMatchInfo').innerText = `vs ${opponent}`;
    const formDiv = document.getElementById('matchStatsForm');
    
    formDiv.innerHTML = '<h4>Player Statistics:</h4>';
    window.players.forEach(player => {
        const existingStats = player.matchStats?.[fixtureId];
        formDiv.innerHTML += `
            <div class="player-stats-row">
                <strong>${player.name} (${player.position})</strong><br>
                Goals: <input type="number" id="goals_${player._id}" value="${existingStats?.goals || 0}" min="0" style="width:60px">
                Assists: <input type="number" id="assists_${player._id}" value="${existingStats?.assists || 0}" min="0" style="width:60px">
                Rating: <input type="number" id="rating_${player._id}" value="${existingStats?.rating || 7}" min="1" max="10" step="0.5" style="width:70px">
                Cards: <select id="cards_${player._id}">
                    <option value="none" ${existingStats?.cards === 'none' ? 'selected' : ''}>None</option>
                    <option value="yellow" ${existingStats?.cards === 'yellow' ? 'selected' : ''}>Yellow</option>
                    <option value="red" ${existingStats?.cards === 'red' ? 'selected' : ''}>Red</option>
                </select>
            </div>
        `;
    });
    
    if (!canEdit()) {
        document.querySelectorAll('#matchStatsForm input, #matchStatsForm select').forEach(el => el.disabled = true);
        document.getElementById('saveMatchStatsBtn').style.display = 'none';
    } else {
        document.getElementById('saveMatchStatsBtn').style.display = 'block';
    }
    
    document.getElementById('matchStatsModal').style.display = 'block';
}

// ========== EXPORT & REPORT ==========
function exportStatsToCSV() {
    const csvRows = [['Player Name', 'Jersey', 'Position', 'Appearances', 'Goals', 'Assists', 'Average Rating', 'Cards']];
    
    window.players.forEach(player => {
        const stats = getPlayerSeasonStats(player);
        csvRows.push([player.name, player.jersey, player.position, stats.apps, stats.goals, stats.assists, stats.avgRating, stats.cards]);
    });
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n