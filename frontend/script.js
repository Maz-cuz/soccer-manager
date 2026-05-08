// ========== DATA STRUCTURE ==========
let players = [];
let fixtures = [];
let currentSessionDate = new Date().toISOString().split('T')[0];

// ========== LOAD/SAVE ==========
function loadData() {
    const storedPlayers = localStorage.getItem('midvaalensPlayers');
    const storedFixtures = localStorage.getItem('midvaalensFixtures');
    players = storedPlayers ? JSON.parse(storedPlayers) : [];
    fixtures = storedFixtures ? JSON.parse(storedFixtures) : [];
    render();
}

function saveData() {
    localStorage.setItem('midvaalensPlayers', JSON.stringify(players));
    localStorage.setItem('midvaalensFixtures', JSON.stringify(fixtures));
}

// ========== PLAYER CRUD ==========
function addPlayer(name, jersey, position, photoBase64 = null) {
    if (!name.trim()) return alert('Name required');
    const newPlayer = {
        id: Date.now(),
        name: name.trim(),
        jersey: jersey.trim(),
        position: position.trim(),
        fitness: 'fit',
        attendance: {},
        payments: {},
        matchStats: {},
        photo: photoBase64
    };
    players.push(newPlayer);
    saveData();
    render();
}

function deletePlayer(playerId) {
    if (confirm('Are you sure you want to delete this player?')) {
        players = players.filter(p => p.id !== playerId);
        saveData();
        render();
    }
}

function editPlayer(playerId, updatedData) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        Object.assign(player, updatedData);
        saveData();
        render();
    }
}

function updateFitness(playerId, fitness) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        player.fitness = fitness;
        saveData();
        render();
    }
}

function markAttendance(playerId, status) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        if (!player.attendance) player.attendance = {};
        player.attendance[currentSessionDate] = status;
        saveData();
        render();
    }
}

function markAllPresent() {
    players.forEach(player => {
        if (!player.attendance) player.attendance = {};
        player.attendance[currentSessionDate] = 'present';
    });
    saveData();
    render();
}

function getLast5Attendance(player) {
    if (!player.attendance) return [];
    const dates = Object.keys(player.attendance).sort().reverse().slice(0, 5);
    return dates.map(date => player.attendance[date]);
}

// ========== FIXTURE CRUD ==========
function addFixture(opponent, date, venue, location) {
    if (!opponent || !date) return alert('Opponent and date required');
    const newFixture = {
        id: Date.now(),
        opponent: opponent,
        date: date,
        venue: venue,
        location: location || 'TBD',
        isCompleted: false,
        result: null,
        matchStatsRecorded: false
    };
    fixtures.push(newFixture);
    fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveData();
    renderFixtures();
}

function deleteFixture(fixtureId) {
    if (confirm('Delete this fixture? This will also remove all match stats.')) {
        // Remove match stats linked to this fixture
        players.forEach(player => {
            if (player.matchStats && player.matchStats[fixtureId]) {
                delete player.matchStats[fixtureId];
            }
        });
        fixtures = fixtures.filter(f => f.id !== fixtureId);
        saveData();
        renderFixtures();
        renderStats();
    }
}

function editFixture(fixtureId, updatedData) {
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (fixture) {
        Object.assign(fixture, updatedData);
        saveData();
        renderFixtures();
    }
}

function editFixturePrompt(fixtureId) {
    const fixture = fixtures.find(f => f.id === fixtureId);
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

function completeFixture(fixtureId, homeScore, awayScore) {
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (fixture) {
        fixture.isCompleted = true;
        fixture.result = { homeScore, awayScore };
        saveData();
        renderFixtures();
    }
}

// ========== MATCH STATISTICS ==========
function recordMatchStats(fixtureId, statsData) {
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture) return;
    
    Object.keys(statsData).forEach(playerId => {
        const player = players.find(p => p.id === parseInt(playerId));
        if (player) {
            if (!player.matchStats) player.matchStats = {};
            player.matchStats[fixtureId] = statsData[playerId];
        }
    });
    
    fixture.matchStatsRecorded = true;
    saveData();
    render();
}

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

// ========== PAYMENTS ==========
function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function hasPaidCurrentMonth(player) {
    return player.payments && player.payments[getCurrentMonth()] === true;
}

function markPayment(playerId) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        if (!player.payments) player.payments = {};
        player.payments[getCurrentMonth()] = true;
        saveData();
        renderPayments();
    }
}

// ========== EXPORT STATS TO CSV ==========
function exportStatsToCSV() {
    const csvRows = [];
    csvRows.push(['Player Name', 'Jersey', 'Position', 'Appearances', 'Goals', 'Assists', 'Average Rating', 'Cards']);
    
    players.forEach(player => {
        const stats = getPlayerSeasonStats(player);
        csvRows.push([
            player.name,
            player.jersey,
            player.position,
            stats.apps,
            stats.goals,
            stats.assists,
            stats.avgRating,
            stats.cards
        ]);
    });
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `midvaalens_stats_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ========== SEND REPORT (WhatsApp/Email) ==========
function generateMatchReport(fixtureId) {
    const fixture = fixtures.find(f => f.id === fixtureId);
    if (!fixture) return 'No fixture selected';
    
    let report = `🏆 MIDVAALENS YD - MATCH REPORT 🏆\n\n`;
    report += `Opponent: ${fixture.opponent}\n`;
    report += `Date: ${fixture.date}\n`;
    report += `Venue: ${fixture.venue} (${fixture.location})\n`;
    
    if (fixture.result) {
        report += `Result: ${fixture.result.homeScore} - ${fixture.result.awayScore}\n\n`;
    }
    
    report += `📊 PLAYER STATISTICS:\n`;
    report += `----------------------------------------\n`;
    
    let hasStats = false;
    players.forEach(player => {
        const stats = player.matchStats?.[fixtureId];
        if (stats && (stats.goals > 0 || stats.assists > 0 || stats.rating)) {
            hasStats = true;
            report += `\n${player.name} (#${player.jersey})\n`;
            if (stats.goals > 0) report += `  ⚽ Goals: ${stats.goals}\n`;
            if (stats.assists > 0) report += `  🎯 Assists: ${stats.assists}\n`;
            if (stats.rating) report += `  ⭐ Rating: ${stats.rating}/10\n`;
            if (stats.cards !== 'none') report += `  🟨 Cards: ${stats.cards}\n`;
        }
    });
    
    if (!hasStats) report += `No statistics recorded for this match yet.\n`;
    
    report += `\n---\nMidvaalens YD | Growing Champions! ⚽`;
    return report;
}

function sendReport() {
    const fixtureId = parseInt(document.getElementById('reportFixtureSelect').value);
    const method = document.getElementById('reportMethod').value;
    const recipient = document.getElementById('reportRecipient').value;
    
    if (!fixtureId || !recipient) {
        alert('Please select a fixture and enter recipient info');
        return;
    }
    
    const report = generateMatchReport(fixtureId);
    const encodedReport = encodeURIComponent(report);
    
    if (method === 'whatsapp') {
        let phone = recipient.replace(/[^0-9]/g, '');
        if (!phone.startsWith('27') && phone.length === 10) phone = '27' + phone;
        const whatsappUrl = `https://wa.me/${phone}?text=${encodedReport}`;
        window.open(whatsappUrl, '_blank');
    } else if (method === 'email') {
        const subject = encodeURIComponent(`Match Report: ${fixtures.find(f => f.id === fixtureId)?.opponent}`);
        const emailUrl = `mailto:${recipient}?subject=${subject}&body=${encodedReport}`;
        window.open(emailUrl, '_blank');
    }
    
    alert('Report sent! Check your WhatsApp/Email app.');
}

// ========== RENDER FUNCTIONS ==========
function renderPlayers() {
    const tbody = document.getElementById('playerTableBody');
    if (!tbody) return;
    
    const todayPresent = players.filter(p => p.attendance?.[currentSessionDate] === 'present').length;
    const fitCount = players.filter(p => p.fitness === 'fit').length;
    
    document.getElementById('totalPlayers').innerText = players.length;
    document.getElementById('todayAttendance').innerText = todayPresent;
    document.getElementById('fitCount').innerText = fitCount;
    
    tbody.innerHTML = '';
    players.forEach(player => {
        const todayStatus = player.attendance?.[currentSessionDate] || 'not marked';
        const last5 = getLast5Attendance(player);
        const historyDisplay = last5.map(s => s === 'present' ? '✅' : s === 'absent' ? '❌' : '⬜').join('');
        
        const row = tbody.insertRow();
        
        // Photo cell
        const photoCell = row.insertCell(0);
        if (player.photo) {
            const img = document.createElement('img');
            img.src = player.photo;
            img.className = 'player-photo';
            img.style.width = '40px';
            img.style.height = '40px';
            img.style.borderRadius = '50%';
            img.style.objectFit = 'cover';
            photoCell.appendChild(img);
        } else {
            photoCell.innerHTML = '📸';
        }
        
        row.insertCell(1).innerText = player.name;
        row.insertCell(2).innerText = player.jersey;
        row.insertCell(3).innerText = player.position;
        
        // Fitness dropdown
        const fitnessCell = row.insertCell(4);
        const select = document.createElement('select');
        select.className = `fitness-select fitness-${player.fitness}`;
        ['fit', 'doubtful', 'unfit'].forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
            if (player.fitness === opt) option.selected = true;
            select.appendChild(option);
        });
        select.onchange = (e) => updateFitness(player.id, e.target.value);
        fitnessCell.appendChild(select);
        
        row.insertCell(5).innerHTML = todayStatus === 'present' ? '✅ Present' : todayStatus === 'absent' ? '❌ Absent' : '⚪';
        row.insertCell(6).innerHTML = `<span class="attendance-history">${historyDisplay || '⬜⬜⬜⬜⬜'}</span>`;
        
        const actionCell = row.insertCell(7);
        const presentBtn = document.createElement('button');
        presentBtn.innerText = '✅';
        presentBtn.className = 'attendance-btn';
        presentBtn.title = 'Mark Present';
        presentBtn.onclick = () => markAttendance(player.id, 'present');
        
        const absentBtn = document.createElement('button');
        absentBtn.innerText = '❌';
        absentBtn.className = 'attendance-btn absent';
        absentBtn.title = 'Mark Absent';
        absentBtn.onclick = () => markAttendance(player.id, 'absent');
        
        const editBtn = document.createElement('button');
        editBtn.innerText = '✏️';
        editBtn.className = 'edit-btn';
        editBtn.title = 'Edit Player';
        editBtn.onclick = () => {
            const newName = prompt('Edit name:', player.name);
            if (newName) editPlayer(player.id, { name: newName });
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = '🗑️';
        deleteBtn.className = 'delete-btn';
        deleteBtn.title = 'Delete Player';
        deleteBtn.onclick = () => deletePlayer(player.id);
        
        actionCell.appendChild(presentBtn);
        actionCell.appendChild(absentBtn);
        actionCell.appendChild(editBtn);
        actionCell.appendChild(deleteBtn);
    });
}

function renderFixtures() {
    const upcomingDiv = document.getElementById('upcomingFixtures');
    const pastDiv = document.getElementById('pastFixtures');
    if (!upcomingDiv) return;
    
    const now = new Date().toISOString().split('T')[0];
    const upcoming = fixtures.filter(f => !f.isCompleted && f.date >= now);
    const past = fixtures.filter(f => f.isCompleted || f.date < now);
    
    upcomingDiv.innerHTML = upcoming.length ? '' : '<p>No upcoming fixtures</p>';
    upcoming.forEach(fixture => {
        upcomingDiv.innerHTML += `
            <div class="fixture-card">
                <div>
                    <strong>${fixture.opponent}</strong><br>
                    📅 ${fixture.date} | ${fixture.venue} at ${fixture.location}
                </div>
                <div class="fixture-actions">
                    <button class="edit-btn" onclick="editFixturePrompt(${fixture.id})">✏️ Edit</button>
                    <button class="delete-btn" onclick="deleteFixture(${fixture.id})">🗑️ Delete</button>
                    <button onclick="openStatsModal(${fixture.id}, '${fixture.opponent}')">📊 Record Stats</button>
                </div>
            </div>
        `;
    });
    
    pastDiv.innerHTML = past.length ? '' : '<p>No past fixtures</p>';
    past.forEach(fixture => {
        const resultText = fixture.result ? `${fixture.result.homeScore} - ${fixture.result.awayScore}` : 'No result yet';
        pastDiv.innerHTML += `
            <div class="fixture-card completed">
                <div>
                    <strong>${fixture.opponent}</strong><br>
                    📅 ${fixture.date} | ${fixture.venue}<br>
                    🏆 Result: ${resultText}
                </div>
                <div class="fixture-actions">
                    ${!fixture.matchStatsRecorded ? `<button onclick="openStatsModal(${fixture.id}, '${fixture.opponent}')">📊 Record Stats</button>` : '✅ Stats recorded'}
                    <button class="delete-btn" onclick="deleteFixture(${fixture.id})">🗑️ Delete</button>
                </div>
            </div>
        `;
    });
    
    // Update report modal dropdown
    const select = document.getElementById('reportFixtureSelect');
    if (select) {
        select.innerHTML = '<option value="">Select fixture...</option>';
        [...upcoming, ...past].forEach(fixture => {
            select.innerHTML += `<option value="${fixture.id}">${fixture.opponent} (${fixture.date})</option>`;
        });
    }
}

function renderStats() {
    const tbody = document.getElementById('statsTableBody');
    if (!tbody) return;
    
    let topScorer = { name: '', goals: 0 };
    let topRated = { name: '', rating: 0 };
    let totalGoals = 0;
    
    const statsRows = players.map(player => {
        const stats = getPlayerSeasonStats(player);
        totalGoals += stats.goals;
        if (stats.goals > topScorer.goals) topScorer = { name: player.name, goals: stats.goals };
        if (stats.avgRating !== '-' && parseFloat(stats.avgRating) > topRated.rating) topRated = { name: player.name, rating: parseFloat(stats.avgRating) };
        
        return `<tr>
            <td><strong>${player.name}</strong> ${player.photo ? '📸' : ''}</td>
            <td>${stats.apps}</td>
            <td>⭐ ${stats.goals}</td>
            <td>🎯 ${stats.assists}</td>
            <td>${stats.avgRating}</td>
            <td>${stats.cards}</td>
        </tr>`;
    });
    
    tbody.innerHTML = statsRows.join('');
    document.getElementById('topScorer').innerHTML = `${topScorer.name || '-'}<br><small>${topScorer.goals} goals</small>`;
    document.getElementById('topRated').innerHTML = `${topRated.name || '-'}<br><small>${topRated.rating} avg</small>`;
    document.getElementById('totalGoals').innerText = totalGoals;
}

function renderPayments() {
    const monthSpan = document.getElementById('paymentMonth');
    const summaryDiv = document.getElementById('paymentsSummary');
    const paymentsList = document.getElementById('paymentsList');
    if (!monthSpan) return;
    
    monthSpan.innerText = getCurrentMonth();
    const paidCount = players.filter(p => hasPaidCurrentMonth(p)).length;
    const collected = paidCount * 70;
    const outstanding = (players.length - paidCount) * 70;
    
    summaryDiv.innerHTML = `<strong>💰 R${collected}</strong> collected | <strong>⚠️ R${outstanding}</strong> outstanding | 📊 ${paidCount}/${players.length} players paid`;
    
    // FIXED: Properly closed table with no syntax errors
    let tableHtml = '<table style="width:100%">';
    tableHtml += '<thead><tr><th>Player</th><th>Photo</th><th>Status</th><th>Action</th></tr></thead><tbody>';
    
    players.forEach(player => {
        const paid = hasPaidCurrentMonth(player);
        tableHtml += `
            <tr>
                <td>${player.name}</td>
                <td>${player.photo ? '<img src="'+player.photo+'" class="player-photo" style="width:30px;height:30px;border-radius:50%;object-fit:cover">' : '📸'}</td>
                <td>${paid ? '✅ Paid R70' : '❌ Unpaid'}</td>
                <td>${!paid ? `<button class="pay-btn" onclick="markPayment(${player.id})">💰 Pay R70</button>` : '✔️ Done for this month'}</td>
            </tr>
        `;
    });
    
    tableHtml += '</tbody></table>';
    paymentsList.innerHTML = tableHtml;
}

function render() {
    renderPlayers();
    renderFixtures();
    renderStats();
    renderPayments();
}

// ========== MODAL FOR MATCH STATS ==========
let currentFixtureId = null;

window.openStatsModal = function(fixtureId, opponent) {
    currentFixtureId = fixtureId;
    document.getElementById('modalMatchInfo').innerText = `vs ${opponent}`;
    const formDiv = document.getElementById('matchStatsForm');
    
    formDiv.innerHTML = '<h4>Record per player:</h4>';
    players.forEach(player => {
        formDiv.innerHTML += `
            <div class="player-stats-row">
                <strong>${player.name} (${player.position})</strong><br>
                Goals: <input type="number" id="goals_${player.id}" value="0" min="0" style="width:60px">
                Assists: <input type="number" id="assists_${player.id}" value="0" min="0" style="width:60px">
                Rating (1-10): <input type="number" id="rating_${player.id}" value="7" min="1" max="10" step="0.5" style="width:70px">
                Cards: <select id="cards_${player.id}">
                    <option value="none">None</option>
                    <option value="yellow">Yellow</option>
                    <option value="red">Red</option>
                </select>
            </div>
        `;
    });
    
    document.getElementById('matchStatsModal').style.display = 'block';
}

// ========== PHOTO UPLOAD HANDLER ==========
function handlePhotoUpload(file, callback) {
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            callback(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        callback(null);
    }
}

// ========== EVENT LISTENERS ==========
document.getElementById('addPlayerBtn')?.addEventListener('click', () => {
    const name = document.getElementById('playerName').value;
    const jersey = document.getElementById('playerJersey').value;
    const position = document.getElementById('playerPosition').value;
    const photoFile = document.getElementById('playerPhoto')?.files[0];
    
    if (photoFile) {
        handlePhotoUpload(photoFile, (photoBase64) => {
            addPlayer(name, jersey, position, photoBase64);
        });
    } else {
        addPlayer(name, jersey, position);
    }
    
    document.getElementById('playerName').value = '';
    document.getElementById('playerJersey').value = '';
    document.getElementById('playerPosition').value = '';
    if (document.getElementById('playerPhoto')) document.getElementById('playerPhoto').value = '';
});

document.getElementById('markAllPresentBtn')?.addEventListener('click', markAllPresent);
document.getElementById('exportStatsCSVBtn')?.addEventListener('click', exportStatsToCSV);
document.getElementById('sendReportBtn')?.addEventListener('click', () => {
    document.getElementById('reportModal').style.display = 'block';
});

document.getElementById('addFixtureBtn')?.addEventListener('click', () => {
    addFixture(
        document.getElementById('fixtureOpponent').value,
        document.getElementById('fixtureDate').value,
        document.getElementById('fixtureVenue').value,
        document.getElementById('fixtureLocation').value
    );
    document.getElementById('fixtureOpponent').value = '';
    document.getElementById('fixtureDate').value = '';
    document.getElementById('fixtureLocation').value = '';
});

document.getElementById('saveMatchStatsBtn')?.addEventListener('click', () => {
    const statsData = {};
    players.forEach(player => {
        const goalsInput = document.getElementById(`goals_${player.id}`);
        const assistsInput = document.getElementById(`assists_${player.id}`);
        const ratingInput = document.getElementById(`rating_${player.id}`);
        const cardsSelect = document.getElementById(`cards_${player.id}`);
        
        statsData[player.id] = {
            goals: goalsInput ? parseInt(goalsInput.value) || 0 : 0,
            assists: assistsInput ? parseInt(assistsInput.value) || 0 : 0,
            rating: ratingInput ? parseFloat(ratingInput.value) || 7 : 7,
            cards: cardsSelect ? cardsSelect.value : 'none'
        };
    });
    recordMatchStats(currentFixtureId, statsData);
    document.getElementById('matchStatsModal').style.display = 'none';
    renderFixtures();
    renderStats();
});

document.getElementById('sendReportBtnModal')?.addEventListener('click', sendReport);

// Close modals
document.querySelector('.close')?.addEventListener('click', () => {
    document.getElementById('matchStatsModal').style.display = 'none';
});

document.querySelector('.close-report')?.addEventListener('click', () => {
    document.getElementById('reportModal').style.display = 'none';
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('matchStatsModal');
    const reportModal = document.getElementById('reportModal');
    if (event.target === modal) modal.style.display = 'none';
    if (event.target === reportModal) reportModal.style.display = 'none';
}

// ========== TAB SWITCHING ==========
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tabId}Tab`).classList.add('active');
    
    // Find the button that was clicked and add active class
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        }
    });
    
    if (tabId === 'stats') renderStats();
    if (tabId === 'fixtures') renderFixtures();
    if (tabId === 'payments') renderPayments();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
    });
});

// Make functions global for onclick handlers
window.markPayment = markPayment;
window.deleteFixture = deleteFixture;
window.editFixturePrompt = editFixturePrompt;
window.deletePlayer = deletePlayer;
window.editPlayer = editPlayer;

// ========== INITIALIZE ==========
loadData();