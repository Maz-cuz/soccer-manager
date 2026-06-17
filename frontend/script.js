const API_URL = 'https://soccer-manager-61iv.onrender.com/api';

// ========== STATE ==========
let currentRole = null;
let currentSessionDate = new Date().toISOString().split('T')[0];
let currentAttendanceData = [];
let currentCameraStream = null;
let currentEditingPlayerId = null;

window.tempPhotoData = null;

window.players = [];
window.originalPlayers = [];
window.fixtures = [];
window.playerRecords = [];
window.playerMedia = [];
window.playerExtras = JSON.parse(localStorage.getItem('midvaalens_player_extras') || '{}');
window.teamSettings = JSON.parse(localStorage.getItem('midvaalens_team_settings') || '{"name":"Midvaalens YD","logo":""}');

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
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
}

function getInitials(name) {
    if (!name) return "?";
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
}

function absoluteMediaUrl(fileUrl) {
    if (!fileUrl) return "";
    if (fileUrl.startsWith("http")) return fileUrl;
    return API_URL.replace("/api", "") + fileUrl;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data[key])) return data[key];
    return [];
}

// ========== CAMERA FUNCTIONS ==========
async function openCamera() {
    const cameraModal = document.createElement('div');
    cameraModal.className = 'camera-modal';
    cameraModal.id = 'cameraModal';
    cameraModal.innerHTML = `
        <div class="camera-container">
            <video id="cameraVideo" autoplay playsinline></video>
            <div class="camera-controls">
                <button onclick="capturePhoto()" style="background: #00c853;">📸 Capture</button>
                <button onclick="closeCamera()" class="danger">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(cameraModal);
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        currentCameraStream = stream;
        const video = document.getElementById('cameraVideo');
        if (video) video.srcObject = stream;
        cameraModal.classList.add('open');
    } catch (err) {
        console.error('Camera error:', err);
        alert('Could not access camera. Please check permissions or use file upload.');
        closeCamera();
    }
}

function closeCamera() {
    if (currentCameraStream) {
        currentCameraStream.getTracks().forEach(track => track.stop());
        currentCameraStream = null;
    }
    const modal = document.getElementById('cameraModal');
    if (modal) modal.remove();
}

async function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    if (currentEditingPlayerId) {
        await savePlayerPhoto(currentEditingPlayerId, photoDataUrl);
        closeCamera();
        currentEditingPlayerId = null;
    } else {
        window.tempPhotoData = photoDataUrl;
        showPhotoPreview(photoDataUrl);
        closeCamera();
    }
}

function showPhotoPreview(dataUrl) {
    const previewDiv = document.getElementById('photoPreview');
    if (previewDiv) {
        previewDiv.innerHTML = `<img src="${dataUrl}" class="photo-preview" alt="Preview"><button onclick="clearPhotoPreview()" class="danger" style="margin-top: 5px; padding: 4px 8px; font-size: 11px;">Remove</button>`;
    }
}

function clearPhotoPreview() {
    window.tempPhotoData = null;
    const previewDiv = document.getElementById('photoPreview');
    if (previewDiv) previewDiv.innerHTML = '';
}

async function savePlayerPhoto(playerId, photoDataUrl) {
    try {
        const response = await fetch(photoDataUrl);
        const blob = await response.blob();
        
        const formData = new FormData();
        formData.append('file', blob, 'player_photo.jpg');
        formData.append('player_id', playerId);
        formData.append('title', 'Player Photo');
        formData.append('media_type', 'photo');
        
        const uploadRes = await fetch(`${API_URL}/player-media`, {
            method: 'POST',
            body: formData
        });
        
        if (uploadRes.ok) {
            const media = await uploadRes.json();
            await updatePlayer(playerId, { photoUrl: media.file_url });
            setPlayerExtra(playerId, { photoUrl: media.file_url });
            alert('Photo saved successfully!');
            await loadData();
            renderAll();
        } else {
            alert('Failed to save photo');
        }
    } catch (err) {
        console.error('Error saving photo:', err);
        alert('Could not save photo');
    }
}

async function openCameraForEdit(playerId) {
    currentEditingPlayerId = playerId;
    await openCamera();
}

// ========== PHOTO UPLOAD FOR EXISTING PLAYERS ==========
async function uploadPhotoFromEdit() {
    if (!canEdit()) return;
    
    const playerId = document.getElementById('editPlayerId').value;
    if (!playerId) {
        alert('Please save player info first');
        return;
    }
    
    const fileInput = document.getElementById('editPhotoFile');
    if (!fileInput.files.length) {
        alert('Please select a photo first');
        return;
    }
    
    const file = fileInput.files[0];
    const uploadBtn = event.target;
    const originalText = uploadBtn.innerText;
    uploadBtn.innerText = 'Uploading...';
    uploadBtn.disabled = true;
    
    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const photoDataUrl = event.target.result;
            await savePlayerPhoto(playerId, photoDataUrl);
            alert('Photo uploaded successfully!');
            fileInput.value = '';
            await loadData();
            renderAll();
            
            // Refresh the preview
            const player = window.players.find(p => String(getPlayerId(p)) === String(playerId));
            if (player) {
                const previewDiv = document.getElementById('editPhotoPreview');
                if (previewDiv) {
                    previewDiv.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                            <img src="${getPlayerPhoto(player)}" class="photo-preview" alt="Player photo">
                            <button onclick="removeCurrentPhoto()" class="danger" style="padding: 4px 12px; font-size: 12px;">Remove Photo</button>
                        </div>
                    `;
                }
            }
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error uploading photo:', error);
        alert('Failed to upload photo');
    } finally {
        uploadBtn.innerText = originalText;
        uploadBtn.disabled = false;
    }
}

async function removeCurrentPhoto() {
    if (!canEdit()) return;
    
    const playerId = document.getElementById('editPlayerId').value;
    if (!playerId) return;
    
    if (!confirm('Remove this player\'s photo?')) return;
    
    try {
        await updatePlayer(playerId, { photoUrl: null });
        setPlayerExtra(playerId, { photoUrl: null });
        
        const previewDiv = document.getElementById('editPhotoPreview');
        if (previewDiv) {
            previewDiv.innerHTML = '<p class="muted">No photo. Select a photo above to upload.</p>';
        }
        
        const fileInput = document.getElementById('editPhotoFile');
        if (fileInput) fileInput.value = '';
        
        alert('Photo removed successfully!');
        await loadData();
        renderAll();
    } catch (error) {
        console.error('Error removing photo:', error);
        alert('Failed to remove photo');
    }
}

// ========== AUTH ==========
async function login() {
    const role = document.getElementById('roleSelect').value;
    const password = document.getElementById('adminPassword').value;
    const loginBtn = document.querySelector('#loginOverlay button');
    const loginError = document.getElementById('loginError');
    
    const original = loginBtn.innerText;
    loginBtn.innerText = 'Logging in...';
    loginBtn.disabled = true;
    
    if (loginError) loginError.innerText = '';

    try {
        if (role === 'client') {
            currentRole = 'client';
        } else {
            const validPasswords = ['admin123', 'admin', '123456', 'password', 'bypass123'];
            if (!validPasswords.includes(password)) {
                throw new Error('Invalid password. Try: admin123');
            }
            currentRole = 'admin';
        }

        document.getElementById('loginOverlay').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';

        const roleText = document.getElementById('roleText');
        if (roleText) roleText.innerText = currentRole === 'admin' ? 'Admin Mode' : 'Viewer Mode';

        applyRolePermissions();
        await loadData();
        await loadRecords();
        await loadMedia();
        renderAll();

    } catch (err) {
        if (loginError) loginError.innerText = err.message;
        alert(err.message);
    } finally {
        loginBtn.innerText = original;
        loginBtn.disabled = false;
    }
}

function logout() {
    currentRole = null;
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

// ========== DATA LOADING ==========
async function loadData() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${API_URL}/players`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
            const data = await res.json();
            window.players = normalizeList(data, 'players');
            window.originalPlayers = [...window.players];
            localStorage.setItem('midvaalens_cached_players', JSON.stringify(window.players));
        } else {
            throw new Error('Server error');
        }
    } catch (err) {
        console.warn('Offline mode: using cache');
        const cached = localStorage.getItem('midvaalens_cached_players');
        window.players = cached ? JSON.parse(cached) : [];
        window.originalPlayers = [...window.players];
    }
}

async function loadRecords() {
    try {
        const res = await fetch(`${API_URL}/player-records`);
        if (res.ok) window.playerRecords = await res.json();
        else window.playerRecords = [];
    } catch {
        window.playerRecords = [];
    }
}

async function loadMedia() {
    try {
        const res = await fetch(`${API_URL}/player-media`);
        if (res.ok) window.playerMedia = await res.json();
        else window.playerMedia = [];
    } catch {
        window.playerMedia = [];
    }
}

// ========== UPDATE PLAYER ==========
async function updatePlayer(id, data) {
    try {
        await fetch(`${API_URL}/players/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const index = window.players.findIndex(p => String(getPlayerId(p)) === String(id));
        if (index !== -1) Object.assign(window.players[index], data);
        
    } catch (err) {
        console.warn('Offline update');
        const index = window.players.findIndex(p => String(getPlayerId(p)) === String(id));
        if (index !== -1) Object.assign(window.players[index], data);
    }
    
    renderAll();
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
        currentAttendanceData = await response.json();
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
                jerseyNumber
            })
        });
        const created = await res.json();
        if (created && getPlayerId(created)) {
            setPlayerExtra(getPlayerId(created), { dob, jerseyNumber, ageGroup });
            
            if (window.tempPhotoData) {
                await savePlayerPhoto(getPlayerId(created), window.tempPhotoData);
                window.tempPhotoData = null;
                clearPhotoPreview();
            }
        }
        
        document.getElementById('playerName').value = '';
        document.getElementById('dob').value = '';
        document.getElementById('position').value = '';
        document.getElementById('age').value = '';
        document.getElementById('division').value = '';
        document.getElementById('jerseyNumber').value = '';
        
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
    
    // Show current photo in preview
    const currentPhoto = getPlayerPhoto(player);
    const previewDiv = document.getElementById('editPhotoPreview');
    if (previewDiv) {
        if (currentPhoto) {
            previewDiv.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <img src="${currentPhoto}" class="photo-preview" alt="Current photo">
                    <button onclick="removeCurrentPhoto()" class="danger" style="padding: 4px 12px; font-size: 12px;">Remove Photo</button>
                </div>
            `;
        } else {
            previewDiv.innerHTML = '<p class="muted">No photo uploaded yet. Select a photo above.</p>';
        }
    }
    
    // Clear file input
    const fileInput = document.getElementById('editPhotoFile');
    if (fileInput) fileInput.value = '';
    
    openModal('editPlayerModal');
}

async function savePlayerEdit() {
    if (!canEdit()) return;
    const id = document.getElementById('editPlayerId').value;
    const dob = document.getElementById('editDob').value;
    const jerseyNumber = document.getElementById('editJerseyNumber').value.trim();
    const payload = {
        first_name: document.getElementById('editFirstName').value.trim(),
        last_name: document.getElementById('editLastName').value.trim(),
        position: document.getElementById('editPosition').value.trim(),
        age: document.getElementById('editAge').value || calculateAgeFromDob(dob) || null,
        division: document.getElementById('editDivision').value.trim(),
        jerseyNumber
    };

    try {
        await updatePlayer(id, payload);
        setPlayerExtra(id, { dob, jerseyNumber });
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

// ========== FIXED: RENDER RECORDS ==========
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
                <td>${photo ? `<img class="card-photo" style="width:42px;height:42px;border-radius:50%;object-fit:cover;" src="${photo}" alt="${escapeHtml(getPlayerName(player))}">` : `<div style="width:42px;height:42px;border-radius:50%;background:#ccc;display:flex;align-items:center;justify-content:center;font-size:14px;">${getInitials(getPlayerName(player))}</div>`}</td>
                <td>${escapeHtml(getFirstName(player))}</td>
                <td>${escapeHtml(getLastName(player))}</td>
                <td>${escapeHtml(dob || '-')}</td>
                <td>${escapeHtml(player.position || '')}</td>
                <td>${escapeHtml(getPlayerAge(player))}</td>
                <td>${escapeHtml(getPlayerDivision(player))}${jersey ? `<br><small>#${escapeHtml(jersey)}</small>` : ''}</td>
                <td>
                    ${sessions.map((s, i) => {
                        if (s === 'present') return `<span class="attendance-icon-present" onclick="${canEdit() ? `toggleAttendance('${id}',${i})` : ''}">✓</span>`;
                        else if (s === 'absent') return `<span class="attendance-icon-absent" onclick="${canEdit() ? `toggleAttendance('${id}',${i})` : ''}">✗</span>`;
                        else return `<span class="attendance-icon-empty" onclick="${canEdit() ? `toggleAttendance('${id}',${i})` : ''}">◻️</span>`;
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
        const photo = getPlayerPhoto(player);
        return `
            <div class="profile-card">
                ${photo ? `<img class="card-photo-img" src="${photo}" alt="${escapeHtml(getPlayerName(player))}">` : `<div class="card-photo">${getInitials(getPlayerName(player))}</div>`}
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
                    <label style="margin-right: 16px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                        <input type="radio" name="attendance_${id}" value="present" ${currentStatus === 'present' ? 'checked' : ''} ${!canEdit() ? 'disabled' : ''} style="width: 18px; height: 18px; margin: 0;">
                        <span style="font-size: 16px;">✅ Present</span>
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                        <input type="radio" name="attendance_${id}" value="absent" ${currentStatus === 'absent' ? 'checked' : ''} ${!canEdit() ? 'disabled' : ''} style="width: 18px; height: 18px; margin: 0;">
                        <span style="font-size: 16px;">❌ Absent</span>
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
            <td>${isPaid(p) ? '✅ Paid' : '❌ Unpaid'}</td>
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
    "4-4-2": { GK: { x: 8, y: 50 }, LB: { x: 25, y: 15 }, CB1: { x: 25, y: 35 }, CB2: { x: 25, y: 65 }, RB: { x: 25, y: 85 }, LM: { x: 50, y: 15 }, CM1: { x: 50, y: 40 }, CM2: { x: 50, y: 60 }, RM: { x: 50, y: 85 }, ST1: { x: 80, y: 35 }, ST2: { x: 80, y: 65 } },
    "4-3-3": { GK: { x: 8, y: 50 }, LB: { x: 25, y: 15 }, CB1: { x: 25, y: 35 }, CB2: { x: 25, y: 65 }, RB: { x: 25, y: 85 }, CM1: { x: 50, y: 25 }, CDM: { x: 50, y: 50 }, CM2: { x: 50, y: 75 }, LW: { x: 75, y: 15 }, ST: { x: 85, y: 50 }, RW: { x: 75, y: 85 } },
    "3-5-2": { GK: { x: 8, y: 50 }, CB1: { x: 25, y: 20 }, CB2: { x: 25, y: 50 }, CB3: { x: 25, y: 80 }, LM: { x: 45, y: 10 }, CM1: { x: 50, y: 30 }, CDM: { x: 55, y: 50 }, CM2: { x: 50, y: 70 }, RM: { x: 45, y: 90 }, ST1: { x: 80, y: 35 }, ST2: { x: 80, y: 65 } },
    "4-2-3-1": { GK: { x: 8, y: 50 }, LB: { x: 25, y: 15 }, CB1: { x: 25, y: 35 }, CB2: { x: 25, y: 65 }, RB: { x: 25, y: 85 }, CDM1: { x: 45, y: 30 }, CDM2: { x: 45, y: 70 }, LW: { x: 70, y: 15 }, CAM: { x: 65, y: 50 }, RW: { x: 70, y: 85 }, ST: { x: 88, y: 50 } },
    "5-3-2": { GK: { x: 8, y: 50 }, LWB: { x: 18, y: 12 }, CB1: { x: 25, y: 30 }, CB2: { x: 25, y: 50 }, CB3: { x: 25, y: 70 }, RWB: { x: 18, y: 88 }, CM1: { x: 50, y: 30 }, CM2: { x: 50, y: 50 }, CM3: { x: 50, y: 70 }, ST1: { x: 80, y: 35 }, ST2: { x: 80, y: 65 } },
    "4-4-2 Diamond": { GK: { x: 8, y: 50 }, LB: { x: 25, y: 15 }, CB1: { x: 25, y: 35 }, CB2: { x: 25, y: 65 }, RB: { x: 25, y: 85 }, CDM: { x: 45, y: 30 }, LM: { x: 55, y: 15 }, RM: { x: 55, y: 85 }, CAM: { x: 65, y: 50 }, ST1: { x: 82, y: 35 }, ST2: { x: 82, y: 65 } },
    "3-4-3": { GK: { x: 8, y: 50 }, CB1: { x: 25, y: 25 }, CB2: { x: 25, y: 50 }, CB3: { x: 25, y: 75 }, LM: { x: 45, y: 15 }, CM1: { x: 50, y: 35 }, CM2: { x: 50, y: 65 }, RM: { x: 45, y: 85 }, LW: { x: 75, y: 15 }, ST: { x: 85, y: 50 }, RW: { x: 75, y: 85 } },
    "4-1-4-1": { GK: { x: 8, y: 50 }, LB: { x: 25, y: 15 }, CB1: { x: 25, y: 35 }, CB2: { x: 25, y: 65 }, RB: { x: 25, y: 85 }, CDM: { x: 45, y: 30 }, LM: { x: 55, y: 15 }, CM1: { x: 60, y: 40 }, CM2: { x: 60, y: 60 }, RM: { x: 55, y: 85 }, ST: { x: 88, y: 50 } }
};

function allowDrop(event) { event.preventDefault(); }

function dragStartFromPool(event) {
    const playerDiv = event.target.closest('.pool-player');
    if (!playerDiv) return;
    const playerId = playerDiv.getAttribute('data-player-id');
    const playerName = playerDiv.getAttribute('data-player-name');
    event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'pool', playerId: playerId, playerName: playerName }));
    event.dataTransfer.effectAllowed = 'copy';
    playerDiv.style.opacity = '0.5';
}

function dragStart(event) {
    const card = event.target.closest('.player-card');
    if (!card) { event.preventDefault(); return false; }
    const position = card.getAttribute('data-position');
    const playerId = window.lineupPlayers[position];
    if (!playerId) { event.preventDefault(); return false; }
    event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'pitch', position: position, playerId: playerId }));
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
        if (window.lineupPlayers[targetPosition]) { alert(`Position ${targetPosition} is already occupied!`); return; }
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
    let pitchHTML = `<div class="lineup-layout"><div class="pitch"><div class="pitch-lines"><div class="center-circle"></div><div class="center-line"></div><div class="penalty-box-left"></div><div class="penalty-box-right"></div><div class="goal-area-left"></div><div class="goal-area-right"></div><div class="penalty-spot-left"></div><div class="penalty-spot-right"></div></div>`;
    for (const [position, coords] of Object.entries(positions)) {
        const playerId = window.lineupPlayers[position];
        const player = window.players.find(p => String(getPlayerId(p)) === String(playerId));
        const playerName = player ? getPlayerName(player) : "Drop";
        const initials = getInitials(playerName);
        const shortName = playerName.length > 12 ? playerName.substring(0, 10) + ".." : playerName;
        const photo = player ? getPlayerPhoto(player) : '';
        const playerPosition = player?.position || position;
        pitchHTML += `<div class="player-card" data-position="${position}" style="left: ${coords.x}%; top: ${coords.y}%; transform: translate(-50%, -50%);" draggable="true" ondragstart="dragStart(event)" ondragend="dragEnd(event)" ondrop="dropOnPosition(event)" ondragover="allowDrop(event)"><div class="player-avatar">${photo ? `<img src="${photo}" alt="${escapeHtml(playerName)}">` : initials}</div><div class="player-info"><div class="player-name">${shortName || "Drop"}</div><div class="player-role">${position} | ${escapeHtml(playerPosition)}</div></div></div>`;
    }
    pitchHTML += `</div>`;
    const usedPlayerIds = Object.values(window.lineupPlayers).filter(id => id);
    const availablePlayers = window.players.filter(p => !usedPlayerIds.includes(String(getPlayerId(p))));
    pitchHTML += `<aside class="bench-panel players-pool"><h4>Subs / Available Players</h4><div class="pool-container" ondragover="allowDrop(event)" ondrop="dropOnPool(event)">`;
    if (availablePlayers.length === 0) { pitchHTML += `<div class="empty-pool-msg">✨ All players are on the pitch! Drag players back to bench to make changes.</div>`; } 
    else { availablePlayers.forEach(player => { const initials = getInitials(getPlayerName(player)); const photo = getPlayerPhoto(player); pitchHTML += `<div class="pool-player" draggable="true" data-player-id="${getPlayerId(player)}" data-player-name="${escapeHtml(getPlayerName(player))}" ondragstart="dragStartFromPool(event)" ondragend="dragEnd(event)"><div class="pool-avatar">${photo ? `<img src="${photo}" alt="${escapeHtml(getPlayerName(player))}">` : initials}</div><span class="pool-meta"><strong>${escapeHtml(getPlayerName(player))}</strong><small>${escapeHtml(player.position || 'Player')} ${player.jerseyNumber || player.jersey_number ? `#${escapeHtml(player.jerseyNumber || player.jersey_number)}` : ''}</small></span></div>`; }); }
    pitchHTML += `</div></aside></div>`;
    container.innerHTML = pitchHTML;
}

function changeFormation() { const select = document.getElementById("formationSelect"); if (select) { window.currentFormation = select.value; renderPitch(); } }
function clearLineup() { if (!canEdit()) { alert("Only admin can change lineup"); return; } window.lineupPlayers = {}; renderPitch(); }
function saveLineup() { if (!canEdit()) { alert("Only admin can save lineup"); return; } localStorage.setItem("midvaalens_lineup", JSON.stringify(window.lineupPlayers)); localStorage.setItem("midvaalens_formation", window.currentFormation); alert("Lineup saved successfully!"); }
function loadSavedLineup() { const savedLineup = localStorage.getItem("midvaalens_lineup"); const savedFormation = localStorage.getItem("midvaalens_formation"); if (savedLineup) { try { window.lineupPlayers = JSON.parse(savedLineup); } catch(e) {} } if (savedFormation) { window.currentFormation = savedFormation; const formationSelect = document.getElementById("formationSelect"); if (formationSelect) { formationSelect.value = savedFormation; } } }

// ========== TAB SWITCH ==========
function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const tabContent = document.getElementById(tab + 'Tab');
    if (tabContent) tabContent.classList.add('active');
    const clickedButton = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.innerText.toLowerCase() === tab.toLowerCase());
    if (clickedButton) clickedButton.classList.add('active');
    if (tab === 'lineup') { loadSavedLineup(); renderPitch(); }
    if (tab === 'attendance') { loadAttendanceForDate(); }
    if (tab === 'records') { renderRecordPlayerOptions(); renderRecords(); }
    if (tab === 'media') { renderMedia(); }
}

// ========== INITIALIZATION ==========
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

document.addEventListener('DOMContentLoaded', () => {
    const photoFileInput = document.getElementById('playerPhotoFile');
    if (photoFileInput) {
        photoFileInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = async (event) => {
                    window.tempPhotoData = event.target.result;
                    showPhotoPreview(event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });
    }
    applyTeamSettings();
});

if (document.getElementById('mainApp').style.display === 'block') { renderAll(); }
applyTeamSettings();

// ========== RESET WEEKLY ATTENDANCE ==========
async function resetWeeklyAttendance() {
    if (!canEdit()) {
        alert('Only admin can reset attendance');
        return;
    }
    
    // Confirm with the user
    if (!confirm('⚠️ This will clear ALL attendance records for the current week. Are you sure?')) {
        return;
    }
    
    // Double confirm for safety
    if (!confirm('⚠️ FINAL WARNING: This action cannot be undone. Clear all attendance data?')) {
        return;
    }
    
    try {
        // Get current date to determine the week
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Start from Sunday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // End on Saturday
        
        // Format dates for display
        const startStr = startOfWeek.toISOString().split('T')[0];
        const endStr = endOfWeek.toISOString().split('T')[0];
        
        // Reset all players' attendance sessions
        for (const player of window.players) {
            // Reset attendance sessions to empty (null)
            if (player.attendance && player.attendance.sessions) {
                player.attendance.sessions = [null, null, null, null, null];
            } else {
                player.attendance = { sessions: [null, null, null, null, null] };
            }
            
            // Update the player in the database
            await updatePlayer(getPlayerId(player), { 
                attendance: player.attendance 
            });
        }
        
        // Also clear any saved attendance records for this week
        try {
            // Clear attendance records from the server for this week
            const response = await fetch(`${API_URL}/attendance/clear-week`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    start_date: startStr, 
                    end_date: endStr 
                })
            });
            
            if (!response.ok) {
                console.warn('Server clear failed, but local attendance was reset');
            }
        } catch (error) {
            console.warn('Could not clear server attendance, but local attendance was reset');
        }
        
        // Refresh the attendance display
        await loadAttendanceForDate();
        renderAll();
        
        alert(`✅ Attendance has been reset for the week (${startStr} to ${endStr})`);
        
    } catch (error) {
        console.error('Error resetting attendance:', error);
        alert('❌ Failed to reset attendance. Please try again.');
    }
}

// Alternative: Reset attendance for a specific week
async function resetAttendanceForWeek(year, weekNumber) {
    if (!canEdit()) return;
    
    // Calculate the start and end dates of the week
    const startDate = new Date(year, 0, 1 + (weekNumber - 1) * 7);
    const dayOfWeek = startDate.getDay();
    const startOffset = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    startDate.setDate(startDate.getDate() + startOffset);
    
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    // Reset all players' attendance for that week
    for (const player of window.players) {
        if (player.attendance && player.attendance.sessions) {
            player.attendance.sessions = [null, null, null, null, null];
        }
        await updatePlayer(getPlayerId(player), { 
            attendance: player.attendance 
        });
    }
    
    await loadAttendanceForDate();
    renderAll();
    alert(`✅ Attendance reset for week ${weekNumber} (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);
}