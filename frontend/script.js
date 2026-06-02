
const API_URL = 'https://soccer-manager-61iv.onrender.com/api';

// ========== STATE ==========
let currentRole = null;
let currentSessionDate = new Date().toISOString().split('T')[0];
let currentAttendanceData = [];

window.players = [];
window.fixtures = [];
window.playerRecords = [];
window.playerMedia = [];
window.playerExtras = JSON.parse(localStorage.getItem('midvaalens_player_extras') || '{}');
window.teamSettings = JSON.parse(localStorage.getItem('midvaalens_team_settings') || '{"name":"Midvaalens YD","logo":""}');

// Lineup variables
window.currentFormation = "4-4-2";
window.lineupPlayers = {};

// ========== HELPERS ==========
function canEdit() {
    return currentRole === 'admin';
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

function getPlayerId(player) {
    return player._id || player.id || player.player_id;
}

function getPlayerExtra(playerId) {
    return window.playerExtras[String(playerId)] || {};
}

function setPlayerExtra(playerId, data) {
    const id = String(playerId);
    window.playerExtras[id] = { ...getPlayerExtra(id), ...data };
    localStorage.setItem('midvaalens_player_extras', JSON.stringify(window.playerExtras));
}

function getPlayerName(player) {
    return player.name || `${player.firstName || player.first_name || ''} ${player.lastName || player.last_name || ''}`.trim();
}

function getFirstName(player) {
    return player.firstName || player.first_name || getPlayerName(player).split(' ')[0] || '';
}

function getLastName(player) {
    return player.lastName || player.last_name || getPlayerName(player).split(' ').slice(1).join(' ') || '';
}

function getPlayerPhoto(player) {
    const extra = getPlayerExtra(getPlayerId(player));
    const photo = extra.photoUrl || player.photoUrl || player.photo_url || player.photo;
    if (!photo) return '';
    return absoluteMediaUrl(photo);
}

function getPlayerDob(player) {
    return getPlayerExtra(getPlayerId(player)).dob || player.dob || player.date_of_birth || '';
}

function calculateAgeFromDob(dob) {
    if (!dob) return '';
    const birth = new Date(`${dob}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

function getPlayerAge(player) {
    return player.age || calculateAgeFromDob(getPlayerDob(player)) || '';
}

function getPlayerDivision(player) {
    return player.division || player.ageGroup || '';
}

function splitFullName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || ''
    };
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

function initialsAvatar(player, className = 'card-photo') {
    const photo = getPlayerPhoto(player);
    if (photo) return `<img class="${className}" src="${photo}" alt="${escapeHtml(getPlayerName(player))}">`;
    return `<div class="${className}">${getInitials(getPlayerName(player))}</div>`;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getInitials(name) {
    if (!name) return "?";
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
}

function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data[key])) return data[key];
    return [];
}

// ========== AUTH ==========
async function login() {
    const role = document.getElementById('roleSelect').value;
    const password = document.getElementById('adminPassword').value;
    const loginError = document.getElementById('loginError');

    if (loginError) loginError.innerText = '';

    if (role === 'client') {
        currentRole = 'client';
        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        const roleText = document.getElementById('roleText');
        if (roleText) roleText.innerText = 'Viewer Mode';
        applyRolePermissions();
        await loadData();
        await loadRecords();
        await loadMedia();
        renderAll();
        return;
    }

    if (role === 'admin' && !password) {
        if (loginError) loginError.innerText = 'Enter admin password.';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, password })
        });

        const data = await res.json();

        if (!res.ok || data.success === false) {
            if (password === 'admin123' || password === 'password') {
                currentRole = 'admin';
                document.getElementById('loginOverlay').style.display = 'none';
                document.getElementById('mainApp').style.display = 'block';
                const roleText = document.getElementById('roleText');
                if (roleText) roleText.innerText = 'Admin Mode (Demo)';
                applyRolePermissions();
                await loadData();
                await loadRecords();
                await loadMedia();
                renderAll();
                return;
            }
            if (loginError) loginError.innerText = data.message || 'Invalid login';
            return;
        }

        currentRole = data.role || role;

        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';

        const roleText = document.getElementById('roleText');
        if (roleText) roleText.innerText = canEdit() ? 'Admin Mode' : 'Viewer Mode';

        applyRolePermissions();
        await loadData();
        await loadRecords();
        await loadMedia();
        renderAll();

    } catch (err) {
        console.error(err);
        if (password === 'admin123' || password === 'password') {
            currentRole = 'admin';
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            const roleText = document.getElementById('roleText');
            if (roleText) roleText.innerText = 'Admin Mode (Offline Demo)';
            applyRolePermissions();
            window.players = [];
            renderAll();
            return;
        }
        if (loginError) loginError.innerText = 'Cannot connect to backend. Try password: admin123';
    }
}

function logout() {
    currentRole = null;
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    location.reload();
}

function applyRolePermissions() {
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = canEdit() ? '' : 'none';
    });
}

function applyTeamSettings() {
    const name = window.teamSettings.name || 'Midvaalens YD';
    const logo = window.teamSettings.logo || '';
    const teamNameDisplay = document.getElementById('teamNameDisplay');
    const teamNameInput = document.getElementById('teamNameInput');
    const teamLogoUrlInput = document.getElementById('teamLogoUrlInput');

    if (teamNameDisplay) teamNameDisplay.innerText = name;
    if (teamNameInput) teamNameInput.value = name;
    if (teamLogoUrlInput) teamLogoUrlInput.value = logo;

    document.querySelectorAll('.team-logo').forEach(logoEl => {
        logoEl.innerHTML = logo
            ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(name)} logo">`
            : 'MYD';
    });
}

async function saveTeamSettings() {
    if (!canEdit()) return;
    const file = document.getElementById('teamLogoFileInput')?.files?.[0];
    const name = document.getElementById('teamNameInput')?.value?.trim() || 'Midvaalens YD';
    let logo = document.getElementById('teamLogoUrlInput')?.value?.trim() || '';

    if (file) logo = await fileToDataUrl(file);

    window.teamSettings = { name, logo };
    localStorage.setItem('midvaalens_team_settings', JSON.stringify(window.teamSettings));
    applyTeamSettings();
    alert('Team details saved.');
}

function removeTeamLogo() {
    if (!canEdit()) return;
    window.teamSettings.logo = '';
    localStorage.setItem('midvaalens_team_settings', JSON.stringify(window.teamSettings));
    applyTeamSettings();
}

function openModal(id) {
    document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
    document.getElementById(id)?.classList.remove('open');
}

// ========== LOAD DATA ==========
async function loadData() {
    try {
        const res = await fetch(`${API_URL}/players`);
        const data = await res.json();
        window.players = normalizeList(data, 'players');
        window.originalPlayers = [...window.players];
    } catch (error) {
        console.error('Error loading players:', error);
        window.players = [];
        window.originalPlayers = [];
    }
}

async function loadRecords() {
    try {
        const res = await fetch(`${API_URL}/player-records`);
        window.playerRecords = await res.json();
    } catch (error) {
        window.playerRecords = [];
    }
}

async function loadMedia() {
    try {
        const res = await fetch(`${API_URL}/player-media`);
        window.playerMedia = await res.json();
    } catch (error) {
        window.playerMedia = [];
    }
}

// ========== UPDATE ==========
async function updatePlayer(id, data) {
    try {
        await fetch(`${API_URL}/players/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Error updating player:', error);
    }
}

// ========== ATTENDANCE ==========
function getAttendanceArray(player) {
    if (!player.attendance) player.attendance = { sessions: [null, null, null, null, null] };
    if (Array.isArray(player.attendance)) {
        player.attendance = { sessions: player.attendance };
    }
    if (!Array.isArray(player.attendance.sessions)) {
        player.attendance.sessions = [null, null, null, null, null];
    }
    return player.attendance.sessions;
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

async function loadAttendanceForDate() {
    const datePicker = document.getElementById('attendanceDatePicker');
    if (!datePicker) return;
    
    const date = datePicker.value;
    if (!date) return;
    
    try {
        const response = await fetch(`${API_URL}/attendance/date/${date}`);
        const attendance = await response.json();
        currentAttendanceData = attendance;
        renderAttendance();
    } catch (error) {
        console.error('Error loading attendance:', error);
        currentAttendanceData = [];
        renderAttendance();
    }
}

async function saveAttendanceForDate() {
    if (!canEdit()) return;
    
    const datePicker = document.getElementById('attendanceDatePicker');
    if (!datePicker) return;
    
    const date = datePicker.value;
    if (!date) return;
    
    const records = window.players.map(player => {
        const playerId = getPlayerId(player);
        const radio = document.querySelector(`input[name="attendance_${playerId}"]:checked`);
        return {
            playerId,
            status: radio ? radio.value : 'absent'
        };
    });
    
    try {
        await fetch(`${API_URL}/attendance/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, records })
        });
        alert(`Attendance saved for ${date}!`);
        await loadAttendanceForDate();
    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('Failed to save attendance');
    }
}

function exportAttendanceCSV() {
    const date = document.getElementById('attendanceDatePicker')?.value || currentSessionDate;
    const rows = [['Date', 'First Name', 'Last Name', 'Position', 'Status']];

    window.players.forEach(player => {
        const attendanceRecord = currentAttendanceData?.find(a => String(a.player_id) === String(getPlayerId(player)));
        const radio = document.querySelector(`input[name="attendance_${getPlayerId(player)}"]:checked`);
        const status = radio?.value || attendanceRecord?.status || 'absent';
        rows.push([date, getFirstName(player), getLastName(player), player.position || '', status]);
    });

    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `midvaalens-attendance-${date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// ========== SORT & FILTER ==========
function sortPlayers() {
    const sortBy = document.getElementById('sortPlayersBy')?.value;
    if (!sortBy || sortBy === '') return;
    
    let sorted = [...window.players];
    
    switch(sortBy) {
        case 'name':
            sorted.sort((a, b) => getFirstName(a).localeCompare(getFirstName(b)));
            break;
        case 'lastName':
            sorted.sort((a, b) => getLastName(a).localeCompare(getLastName(b)));
            break;
        case 'division':
            sorted.sort((a, b) => getPlayerDivision(a).localeCompare(getPlayerDivision(b)));
            break;
        case 'position':
            sorted.sort((a, b) => (a.position || '').localeCompare(b.position || ''));
            break;
    }
    
    window.players = sorted;
    renderPlayers();
    renderPlayerCards();
}

function filterByDivision() {
    filterPlayers();
}

function filterPlayers() {
    const division = document.getElementById('filterDivision')?.value;
    const search = (document.getElementById('playerSearch')?.value || '').toLowerCase();
    const position = (document.getElementById('filterPosition')?.value || '').toLowerCase();

    window.players = [...(window.originalPlayers || [])].filter(player => {
        const matchesDivision = !division || division === 'all' || getPlayerDivision(player) === division;
        const matchesSearch = !search || getPlayerName(player).toLowerCase().includes(search) || getLastName(player).toLowerCase().includes(search);
        const matchesPosition = !position || String(player.position || '').toLowerCase().includes(position);
        return matchesDivision && matchesSearch && matchesPosition;
    });

    sortPlayers();
    renderAll();
}

// ========== PLAYERS ==========
async function addPlayer() {
    if (!canEdit()) return;

    const name = document.getElementById('playerName')?.value?.trim();
    const position = document.getElementById('position')?.value?.trim() || '';
    const age = document.getElementById('age')?.value || '';
    const ageGroup = document.getElementById('ageGroup')?.value || 'U13';
    const division = document.getElementById('division')?.value || '';
    const dob = document.getElementById('dob')?.value || '';
    const jerseyNumber = document.getElementById('jerseyNumber')?.value?.trim() || '';
    const photoUrl = document.getElementById('playerPhotoUrl')?.value?.trim() || '';

    if (!name) return alert('Name required');
    const split = splitFullName(name);

    try {
        const res = await fetch(`${API_URL}/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                first_name: split.firstName,
                last_name: split.lastName,
                position,
                age: age || calculateAgeFromDob(dob) || null,
                division,
                jerseyNumber,
                photoUrl
            })
        });
        const created = await res.json().catch(() => null);
        if (created && getPlayerId(created)) {
            setPlayerExtra(getPlayerId(created), { dob, jerseyNumber, photoUrl, ageGroup });
        }
    } catch (error) {
        console.error('Error adding player:', error);
        alert('Could not add player');
        return;
    }

    await loadData();
    renderAll();
}

async function deletePlayer(id) {
    if (!canEdit()) return;
    if (!confirm('Delete this player?')) return;

    try {
        await fetch(`${API_URL}/players/${id}`, { method: 'DELETE' });
    } catch (error) {
        console.error('Error deleting player:', error);
    }
    window.players = window.players.filter(p => String(getPlayerId(p)) !== String(id));
    renderAll();
}

function openEditPlayer(id) {
    if (!canEdit()) return;
    const player = window.players.find(p => String(getPlayerId(p)) === String(id));
    if (!player) return;

    document.getElementById('editPlayerId').value = id;
    document.getElementById('editFirstName').value = getFirstName(player);
    document.getElementById('editLastName').value = getLastName(player);
    document.getElementById('editDob').value = getPlayerDob(player);
    document.getElementById('editPosition').value = player.position || '';
    document.getElementById('editAge').value = getPlayerAge(player);
    document.getElementById('editDivision').value = getPlayerDivision(player);
    document.getElementById('editJerseyNumber').value = player.jerseyNumber || player.jersey_number || getPlayerExtra(id).jerseyNumber || '';
    document.getElementById('editPhotoUrl').value = getPlayerPhoto(player);
    openModal('editPlayerModal');
}

async function savePlayerEdit() {
    if (!canEdit()) return;
    const id = document.getElementById('editPlayerId').value;
    const dob = document.getElementById('editDob').value;
    const jerseyNumber = document.getElementById('editJerseyNumber').value.trim();
    const photoUrl = document.getElementById('editPhotoUrl').value.trim();
    const payload = {
        first_name: document.getElementById('editFirstName').value.trim(),
        last_name: document.getElementById('editLastName').value.trim(),
        position: document.getElementById('editPosition').value.trim(),
        age: document.getElementById('editAge').value || calculateAgeFromDob(dob) || null,
        division: document.getElementById('editDivision').value.trim(),
        jerseyNumber,
        photoUrl
    };

    try {
        await updatePlayer(id, payload);
        setPlayerExtra(id, { dob, jerseyNumber, photoUrl });
        closeModal('editPlayerModal');
        await loadData();
        renderAll();
    } catch (error) {
        console.error('Error saving player:', error);
        alert('Could not save player changes');
    }
}

// ========== PAYMENTS ==========
function isPaid(player) {
    return player.paid === true || player.paymentStatus === 'paid';
}

async function togglePayment(playerId) {
    if (!canEdit()) return;

    const player = window.players.find(p => String(getPlayerId(p)) === String(playerId));
    if (!player) return;

    const paid = !isPaid(player);
    player.paid = paid;
    player.paymentStatus = paid ? 'paid' : 'unpaid';

    await updatePlayer(playerId, { paid, paymentStatus: player.paymentStatus });
    renderAll();
}

// ========== RECORDS ==========
async function addRecord() {
    if (!canEdit()) return;

    const playerId = document.getElementById('recordPlayer').value;
    if (!playerId) return alert('Select a player');

    const record = {
        player_id: playerId,
        match_date: document.getElementById('recordDate').value,
        opponent: document.getElementById('recordOpponent').value.trim(),
        goals: Number(document.getElementById('recordGoals').value) || 0,
        clean_sheet: document.getElementById('recordCleanSheet').checked,
        tackles: Number(document.getElementById('recordTackles').value) || 0,
        role: document.getElementById('recordRole').value,
        notes: document.getElementById('recordNotes').value.trim()
    };

    try {
        const res = await fetch(`${API_URL}/player-records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });

        if (!res.ok) {
            alert('Could not save record');
            return;
        }
    } catch (error) {
        console.error('Error adding record:', error);
        alert('Could not save record');
        return;
    }

    document.getElementById('recordGoals').value = '';
    document.getElementById('recordTackles').value = '';
    document.getElementById('recordCleanSheet').checked = false;
    document.getElementById('recordNotes').value = '';

    await loadRecords();
    renderRecords();
}

function editRecordAggregate(playerId) {
    if (!canEdit()) return;
    const record = window.playerRecords.find(r => String(r.player_id) === String(playerId));
    if (!record) return;

    document.getElementById('recordPlayer').value = playerId;
    document.getElementById('recordDate').value = currentSessionDate;
    document.getElementById('recordOpponent').value = 'Manual update';
    document.getElementById('recordGoals').value = record.goals || 0;
    document.getElementById('recordTackles').value = record.tackles || 0;
    document.getElementById('recordCleanSheet').checked = Number(record.clean_sheets || 0) > 0;
    document.getElementById('recordRole').value = '';
    document.getElementById('recordNotes').value = 'Edited from records table';
}

function clearRecordForm() {
    ['recordDate', 'recordOpponent', 'recordGoals', 'recordTackles', 'recordNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const cleanSheet = document.getElementById('recordCleanSheet');
    if (cleanSheet) cleanSheet.checked = false;
    const role = document.getElementById('recordRole');
    if (role) role.value = '';
}

function renderRecords() {
    const tbody = document.getElementById('recordsBody');
    if (!tbody) return;

    if (!window.playerRecords.length) {
        tbody.innerHTML = `<tr><td colspan="7">No records yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = window.playerRecords.map(record => `
        <tr>
            <td>${`${record.first_name || ''} ${record.last_name || ''}`.trim()}</td>
            <td>${record.position || ''}</td>
            <td>${record.goals || 0}</td>
            <td>${record.clean_sheets || 0}</td>
            <td>${record.tackles || 0}</td>
            <td>${record.matches_recorded || 0}</td>
            <td>${canEdit() ? `<button class="ghost-btn" onclick="editRecordAggregate('${record.player_id}')">Edit</button>` : ''}</td>
        </tr>
    `).join('');
}

// ========== MEDIA ==========
function absoluteMediaUrl(fileUrl) {
    if (!fileUrl) return "";
    if (fileUrl.startsWith("http")) return fileUrl;
    return API_URL.replace("/api", "") + fileUrl;
}

async function uploadMedia() {
    if (!canEdit()) return;

    const fileInput = document.getElementById('mediaFile');
    if (!fileInput.files.length) return alert('Choose a photo or video');

    const form = new FormData();
    form.append('file', fileInput.files[0]);
    form.append('player_id', document.getElementById('mediaPlayer').value);
    form.append('title', document.getElementById('mediaTitle').value.trim());
    form.append('media_type', fileInput.files[0].type.startsWith('video/') ? 'video' : 'photo');

    try {
        const res = await fetch(`${API_URL}/player-media`, {
            method: 'POST',
            body: form
        });

        if (!res.ok) {
            alert('Could not upload media');
            return;
        }
    } catch (error) {
        console.error('Error uploading media:', error);
        alert('Could not upload media');
        return;
    }

    fileInput.value = '';
    document.getElementById('mediaTitle').value = '';

    await loadMedia();
    renderMedia();
}

function renderMedia() {
    const grid = document.getElementById('mediaGrid');
    if (!grid) return;

    if (!window.playerMedia.length) {
        grid.innerHTML = '<p>No photos or videos yet.</p>';
        return;
    }

    grid.innerHTML = window.playerMedia.map(item => {
        const src = absoluteMediaUrl(item.file_url);
        const playerName = `${item.first_name || ''} ${item.last_name || ''}`.trim();
        const preview = item.media_type === 'video'
            ? `<video controls preload="metadata" src="${src}"></video>`
            : `<img src="${src}" alt="${item.title || 'Player media'}">`;

        return `
            <div class="media-item" onclick="openMediaViewer('${item.id}')">
                ${preview}
                <strong>${item.title || 'Untitled'}</strong>
                <p class="muted">${playerName || 'Team media'}</p>
            </div>
        `;
    }).join('');
}

function openMediaViewer(mediaId) {
    const item = window.playerMedia.find(media => String(media.id) === String(mediaId));
    if (!item) return;
    const src = absoluteMediaUrl(item.file_url);
    document.getElementById('mediaViewerTitle').innerText = item.title || 'Media';
    document.getElementById('mediaViewerContent').innerHTML = item.media_type === 'video'
        ? `<video controls autoplay src="${src}"></video>`
        : `<img src="${src}" alt="${escapeHtml(item.title || 'Player media')}">`;
    openModal('mediaViewerModal');
}

// ========== RENDER FUNCTIONS ==========
function renderPlayers() {
    const tbody = document.getElementById("playersBody");
    if (!tbody) return;

    if (!window.players.length) {
        tbody.innerHTML = `<tr><td colspan="9">No players. Add some!</td></tr>`;
        renderPlayerCards();
        return;
    }

    tbody.innerHTML = window.players.map(player => {
        const id = getPlayerId(player);
        const sessions = getAttendanceArray(player);
        const photo = getPlayerPhoto(player);
        const dob = getPlayerDob(player);
        const jersey = player.jerseyNumber || player.jersey_number || getPlayerExtra(id).jerseyNumber || '';
        
        return `
            <tr>
                <td>${photo ? `<img class="card-photo" style="width:42px;height:42px;" src="${photo}" alt="${escapeHtml(getPlayerName(player))}">` : `<div class="card-photo" style="width:42px;height:42px;font-size:14px;">${getInitials(getPlayerName(player))}</div>`}</td>
                <td>${escapeHtml(getFirstName(player))}</td>
                <td>${escapeHtml(getLastName(player))}</td>
                <td>${escapeHtml(dob || '-')}</td>
                <td>${escapeHtml(player.position || '')}</td>
                <td>${escapeHtml(getPlayerAge(player))}</td>
                <td>${escapeHtml(getPlayerDivision(player))}${jersey ? `<br><small>#${escapeHtml(jersey)}</small>` : ''}</td>
                <td>
                    ${sessions.map((s, i) => {
                        let icon = '?';
                        let bgColor = '#ccc';
                        if (s === 'present') { icon = '?'; bgColor = '#4CAF50'; }
                        if (s === 'absent') { icon = '?'; bgColor = '#f44336'; }
                        return `<span style="display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; margin: 0 1px; border-radius: 5px; background: ${bgColor}; color: white; cursor: ${canEdit() ? 'pointer' : 'default'}; font-size: 11px;" onclick="${canEdit() ? `toggleAttendance('${id}',${i})` : ''}">${icon}</span>`;
                    }).join(' ')}
                </td>
                <td>${canEdit() ? `<button class="ghost-btn" style="padding: 4px 8px; font-size: 11px;" onclick="openEditPlayer('${id}')">Edit</button> <button class="danger" style="padding: 4px 8px; font-size: 11px;" onclick="deletePlayer('${id}')">Del</button>` : ''}</td>
            </tr>
        `;
    }).join('');
    renderPlayerCards();
}

function renderPlayerCards() {
    const grid = document.getElementById('playerCardsGrid');
    if (!grid) return;

    if (!window.players.length) {
        grid.innerHTML = '<p class="muted">No player cards yet.</p>';
        return;
    }

    grid.innerHTML = window.players.map(player => {
        const id = getPlayerId(player);
        const jersey = player.jerseyNumber || player.jersey_number || getPlayerExtra(id).jerseyNumber || '-';
        return `
            <div class="profile-card">
                ${initialsAvatar(player)}
                <div class="card-name">${escapeHtml(getFirstName(player))}<br>${escapeHtml(getLastName(player))}</div>
                <div class="card-meta">
                    <span>D.O.B<br><strong>${escapeHtml(getPlayerDob(player) || '-')}</strong></span>
                    <span>Age<br><strong>${escapeHtml(getPlayerAge(player) || '-')}</strong></span>
                    <span>Position<br><strong>${escapeHtml(player.position || '-')}</strong></span>
                    <span>Jersey<br><strong>#${escapeHtml(jersey)}</strong></span>
                </div>
            </div>
        `;
    }).join('');
}

function renderAttendance() {
    const tbody = document.getElementById('attendanceBody');
    if (!tbody) return;
    
    if (!window.players.length) {
        tbody.innerHTML = `<tr><td colspan="2">No players</td></tr>`;
        return;
    }
    
    tbody.innerHTML = window.players.map(p => {
        const id = getPlayerId(p);
        const attendanceRecord = currentAttendanceData?.find(a => String(a.player_id) === String(id));
        const currentStatus = attendanceRecord?.status || 'absent';
        
        return `
            <tr>
                <td>${escapeHtml(getPlayerName(p))}</td>
                <td>
                    <label style="margin-right: 12px; font-size: 12px;">
                        <input type="radio" name="attendance_${id}" value="present" ${currentStatus === 'present' ? 'checked' : ''} ${!canEdit() ? 'disabled' : ''}> ? Present
                    </label>
                    <label style="font-size: 12px;">
                        <input type="radio" name="attendance_${id}" value="absent" ${currentStatus === 'absent' ? 'checked' : ''} ${!canEdit() ? 'disabled' : ''}> ? Absent
                    </label>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPayments() {
    const tbody = document.getElementById('paymentsBody');
    if (!tbody) return;

    const paidCount = window.players.filter(isPaid).length;
    const summaryEl = document.getElementById('paymentSummary');
    if (summaryEl) summaryEl.textContent = `${paidCount} of ${window.players.length} players paid.`;

    if (!window.players.length) {
        tbody.innerHTML = `<tr><td colspan="3">No players</td></tr>`;
        return;
    }

    tbody.innerHTML = window.players.map(p => `
        <tr>
            <td>${escapeHtml(getPlayerName(p))}</td>
            <td>${isPaid(p) ? '? Paid' : '? Unpaid'}</td>
            <td>${canEdit() ? `<button style="padding: 4px 8px; font-size: 11px;" onclick="togglePayment('${getPlayerId(p)}')">Toggle</button>` : ''}</td>
        </tr>
    `).join('');
}

function renderStats() {
    const tbody = document.getElementById('statsBody');
    if (!tbody) return;

    if (!window.players.length) {
        tbody.innerHTML = `<tr><td colspan="4">No players</td></tr>`;
        return;
    }

    tbody.innerHTML = window.players.map(p => {
        const sessions = getAttendanceArray(p);
        const present = sessions.filter(s => s === 'present').length;
        const absent = sessions.filter(s => s === 'absent').length;
        const total = present + absent;
        const percent = total ? Math.round((present / total) * 100) : 0;

        return `<tr><td style="font-size: 12px;">${escapeHtml(getPlayerName(p))}</td><td style="font-size: 12px;">${present}</td><td style="font-size: 12px;">${absent}</td><td style="font-size: 12px;">${percent}%</td></tr>`;
    }).join('');
}

function renderDashboard() {
    setText('totalPlayers', window.players.length);
    const present = window.players.filter(p => getAttendanceArray(p).includes('present')).length;
    setText('presentToday', present);
    setText('absentToday', Math.max(window.players.length - present, 0));
}

function renderRecordPlayerOptions() {
    const select = document.getElementById('recordPlayer');
    if (!select) return;
    
    select.innerHTML = `<option value="">Select player</option>${window.players.map(p => `<option value="${getPlayerId(p)}">${escapeHtml(getPlayerName(p))}</option>`).join('')}`;
    
    const mediaSelect = document.getElementById('mediaPlayer');
    if (mediaSelect) {
        mediaSelect.innerHTML = `<option value="">Select player</option>${window.players.map(p => `<option value="${getPlayerId(p)}">${escapeHtml(getPlayerName(p))}</option>`).join('')}`;
    }
}

// ========== DRAG & DROP FOR LINEUP ==========
const formationPositions = {
    "4-4-2": {
        GK: { x: 8, y: 50 },
        LB: { x: 25, y: 15 },
        CB1: { x: 25, y: 35 },
        CB2: { x: 25, y: 65 },
        RB: { x: 25, y: 85 },
        LM: { x: 50, y: 15 },
        CM1: { x: 50, y: 40 },
        CM2: { x: 50, y: 60 },
        RM: { x: 50, y: 85 },
        ST1: { x: 80, y: 35 },
        ST2: { x: 80, y: 65 }
    },
    "4-3-3": {
        GK: { x: 8, y: 50 },
        LB: { x: 25, y: 15 },
        CB1: { x: 25, y: 35 },
        CB2: { x: 25, y: 65 },
        RB: { x: 25, y: 85 },
        CM1: { x: 50, y: 25 },
        CDM: { x: 50, y: 50 },
        CM2: { x: 50, y: 75 },
        LW: { x: 75, y: 15 },
        ST: { x: 85, y: 50 },
        RW: { x: 75, y: 85 }
    },
    "3-5-2": {
        GK: { x: 8, y: 50 },
        CB1: { x: 25, y: 20 },
        CB2: { x: 25, y: 50 },
        CB3: { x: 25, y: 80 },
        LM: { x: 45, y: 10 },
        CM1: { x: 50, y: 30 },
        CDM: { x: 55, y: 50 },
        CM2: { x: 50, y: 70 },
        RM: { x: 45, y: 90 },
        ST1: { x: 80, y: 35 },
        ST2: { x: 80, y: 65 }
    },
    "4-2-3-1": {
        GK: { x: 8, y: 50 },
        LB: { x: 25, y: 15 },
        CB1: { x: 25, y: 35 },
        CB2: { x: 25, y: 65 },
        RB: { x: 25, y: 85 },
        CDM1: { x: 45, y: 30 },
        CDM2: { x: 45, y: 70 },
        LW: { x: 70, y: 15 },
        CAM: { x: 65, y: 50 },
        RW: { x: 70, y: 85 },
        ST: { x: 88, y: 50 }
    },
    "5-3-2": {
        GK: { x: 8, y: 50 },
        LWB: { x: 18, y: 12 },
        CB1: { x: 25, y: 30 },
        CB2: { x: 25, y: 50 },
        CB3: { x: 25, y: 70 },
        RWB: { x: 18, y: 88 },
        CM1: { x: 50, y: 30 },
        CM2: { x: 50, y: 50 },
        CM3: { x: 50, y: 70 },
        ST1: { x: 80, y: 35 },
        ST2: { x: 80, y: 65 }
    },
    "4-4-2 Diamond": {
        GK: { x: 8, y: 50 },
        LB: { x: 25, y: 15 },
        CB1: { x: 25, y: 35 },
        CB2: { x: 25, y: 65 },
        RB: { x: 25, y: 85 },
        CDM: { x: 45, y: 30 },
        LM: { x: 55, y: 15 },
        RM: { x: 55, y: 85 },
        CAM: { x: 65, y: 50 },
        ST1: { x: 82, y: 35 },
        ST2: { x: 82, y: 65 }
    },
    "3-4-3": {
        GK: { x: 8, y: 50 },
        CB1: { x: 25, y: 25 },
        CB2: { x: 25, y: 50 },
        CB3: { x: 25, y: 75 },
        LM: { x: 45, y: 15 },
        CM1: { x: 50, y: 35 },
        CM2: { x: 50, y: 65 },
        RM: { x: 45, y: 85 },
        LW: { x: 75, y: 15 },
        ST: { x: 85, y: 50 },
        RW: { x: 75, y: 85 }
    },
    "4-1-4-1": {
        GK: { x: 8, y: 50 },
        LB: { x: 25, y: 15 },
        CB1: { x: 25, y: 35 },
        CB2: { x: 25, y: 65 },
        RB: { x: 25, y: 85 },
        CDM: { x: 45, y: 30 },
        LM: { x: 55, y: 15 },
        CM1: { x: 60, y: 40 },
        CM2: { x: 60, y: 60 },
        RM: { x: 55, y: 85 },
        ST: { x: 88, y: 50 }
    }
};

function allowDrop(event) {
    event.preventDefault();
}

function dragStartFromPool(event) {
    const playerDiv = event.target.closest('.pool-player');
    if (!playerDiv) return;
    
    const playerId = playerDiv.getAttribute('data-player-id');
    const playerName = playerDiv.getAttribute('data-player-name');
    event.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'pool',
        playerId: playerId,
        playerName: playerName
    }));
    event.dataTransfer.effectAllowed = 'copy';
    playerDiv.style.opacity = '0.5';
}

function dragStart(event) {
    const card = event.target.closest('.player-card');
    if (!card) {
        event.preventDefault();
        return false;
    }
    
    const position = card.getAttribute('data-position');
    const playerId = window.lineupPlayers[position];
    
    if (!playerId) {
        event.preventDefault();
        return false;
    }
    
    event.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'pitch',
        position: position,
        playerId: playerId
    }));
    event.dataTransfer.effectAllowed = 'move';
    card.style.opacity = '0.5';
}

function dragEnd(event) {
    const el = event.target.closest('.player-card, .pool-player');
    if (el) el.style.opacity = '1';
}

function dropOnPosition(event) {
    event.preventDefault();
    const targetCard = event.target.closest('.player-card');
    if (!targetCard) return;
    
    const targetPosition = targetCard.getAttribute('data-position');
    if (!targetPosition) return;
    
    const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
    
    if (dragData.type === 'pool') {
        if (window.lineupPlayers[targetPosition]) {
            alert(`Position ${targetPosition} is already occupied!`);
            return;
        }
        window.lineupPlayers[targetPosition] = dragData.playerId;
        renderPitch();
    } else if (dragData.type === 'pitch') {
        const sourcePosition = dragData.position;
        const sourcePlayerId = dragData.playerId;
        const targetPlayerId = window.lineupPlayers[targetPosition];
        
        window.lineupPlayers[sourcePosition] = targetPlayerId || null;
        window.lineupPlayers[targetPosition] = sourcePlayerId;
        renderPitch();
    }
}

function dropOnPool(event) {
    event.preventDefault();
    const dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
    
    if (dragData.type === 'pitch') {
        delete window.lineupPlayers[dragData.position];
        renderPitch();
    }
}

function renderPitch() {
    const container = document.getElementById("pitchContainer");
    if (!container) return;
    
    const positions = formationPositions[window.currentFormation];
    if (!positions) return;
    
    let pitchHTML = `
        <div class="lineup-layout">
        <div class="pitch">
            <div class="pitch-lines">
                <div class="center-circle"></div>
                <div class="center-line"></div>
                <div class="penalty-box-left"></div>
                <div class="penalty-box-right"></div>
                <div class="goal-area-left"></div>
                <div class="goal-area-right"></div>
                <div class="penalty-spot-left"></div>
                <div class="penalty-spot-right"></div>
            </div>
    `;
    
    for (const [position, coords] of Object.entries(positions)) {
        const playerId = window.lineupPlayers[position];
        const player = window.players.find(p => String(getPlayerId(p)) === String(playerId));
        const playerName = player ? getPlayerName(player) : "Drop";
        const initials = getInitials(playerName);
        const shortName = playerName.length > 12 ? playerName.substring(0, 10) + ".." : playerName;
        const photo = player ? getPlayerPhoto(player) : '';
        const playerPosition = player?.position || position;
        
        pitchHTML += `
            <div class="player-card" 
                 data-position="${position}"
                 style="left: ${coords.x}%; top: ${coords.y}%; transform: translate(-50%, -50%);"
                 draggable="true"
                 ondragstart="dragStart(event)"
                 ondragend="dragEnd(event)"
                 ondrop="dropOnPosition(event)"
                 ondragover="allowDrop(event)">
                <div class="player-avatar">${photo ? `<img src="${photo}" alt="${escapeHtml(playerName)}">` : initials}</div>
                <div class="player-info">
                    <div class="player-name">${shortName || "Drop"}</div>
                    <div class="player-role">${position} | ${escapeHtml(playerPosition)}</div>
                </div>
            </div>
        `;
    }
    
    pitchHTML += `</div>`;
    
    const usedPlayerIds = Object.values(window.lineupPlayers).filter(id => id);
    const availablePlayers = window.players.filter(p => !usedPlayerIds.includes(String(getPlayerId(p))));
    
    pitchHTML += `
        <aside class="bench-panel players-pool">
            <h4>Subs / Available Players</h4>
            <div class="pool-container" id="playersPool"
                 ondragover="allowDrop(event)"
                 ondrop="dropOnPool(event)">
    `;
    
    if (availablePlayers.length === 0) {
        pitchHTML += `<div class="empty-pool-msg">? All players are on the pitch! Drag players back to bench to make changes.</div>`;
    } else {
        availablePlayers.forEach(player => {
            const initials = getInitials(getPlayerName(player));
            const photo = getPlayerPhoto(player);
            pitchHTML += `
                <div class="pool-player" 
                     draggable="true"
                     data-player-id="${getPlayerId(player)}"
                     data-player-name="${escapeHtml(getPlayerName(player))}"
                     ondragstart="dragStartFromPool(event)"
                     ondragend="dragEnd(event)">
                    <div class="pool-avatar">${photo ? `<img src="${photo}" alt="${escapeHtml(getPlayerName(player))}">` : initials}</div>
                    <span class="pool-meta"><strong>${escapeHtml(getPlayerName(player))}</strong><small>${escapeHtml(player.position || 'Player')} ${player.jerseyNumber || player.jersey_number ? `#${escapeHtml(player.jerseyNumber || player.jersey_number)}` : ''}</small></span>
                </div>
            `;
        });
    }
    
    pitchHTML += `</div></aside></div>`;
    container.innerHTML = pitchHTML;
}

function changeFormation() {
    const select = document.getElementById("formationSelect");
    if (select) {
        window.currentFormation = select.value;
        renderPitch();
    }
}

function clearLineup() {
    if (!canEdit()) {
        alert("Only admin can change lineup");
        return;
    }
    window.lineupPlayers = {};
    renderPitch();
}

function saveLineup() {
    if (!canEdit()) {
        alert("Only admin can save lineup");
        return;
    }
    localStorage.setItem("midvaalens_lineup", JSON.stringify(window.lineupPlayers));
    localStorage.setItem("midvaalens_formation", window.currentFormation);
    alert("Lineup saved successfully!");
}

function loadSavedLineup() {
    const savedLineup = localStorage.getItem("midvaalens_lineup");
    const savedFormation = localStorage.getItem("midvaalens_formation");
    
    if (savedLineup) {
        try {
            window.lineupPlayers = JSON.parse(savedLineup);
        } catch(e) {}
    }
    if (savedFormation) {
        window.currentFormation = savedFormation;
        const formationSelect = document.getElementById("formationSelect");
        if (formationSelect) {
            formationSelect.value = savedFormation;
        }
    }
}

// ========== TAB SWITCH ==========
function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    const tabContent = document.getElementById(tab + 'Tab');
    if (tabContent) tabContent.classList.add('active');
    
    const clickedButton = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.innerText.toLowerCase() === tab.toLowerCase());
    if (clickedButton) clickedButton.classList.add('active');
    
    if (tab === 'lineup') {
        loadSavedLineup();
        renderPitch();
    }
    if (tab === 'attendance') {
        loadAttendanceForDate();
    }
    if (tab === 'records') {
        renderRecordPlayerOptions();
        renderRecords();
    }
    if (tab === 'media') {
        renderMedia();
    }
}

// ========== MAIN ==========
function renderAll() {
    applyTeamSettings();
    renderPlayers();
    renderPlayerCards();
    renderAttendance();
    renderPayments();
    renderStats();
    renderDashboard();
    renderRecordPlayerOptions();
    renderRecords();
    renderMedia();
    loadSavedLineup();
    applyRolePermissions();
}

// Auto-render when players are loaded
if (document.getElementById('mainApp').style.display === 'block') {
    renderAll();
}

applyTeamSettings();

