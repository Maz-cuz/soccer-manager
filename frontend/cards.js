// ============= MIDVAALENS YD - COMPLETE SOCCER MANAGEMENT SYSTEM =============

// Sample data
let players = [
    { id: 1, firstName: "Thabo", lastName: "Nkosi", ageGroup: "U13", position: "ST", present: true, paid: true, x: 50, y: 50, photo: "https://via.placeholder.com/60/0b3d2e/white?text=TN" },
    { id: 2, firstName: "Liam", lastName: "Peterson", ageGroup: "U13", position: "CM", present: false, paid: false, x: 30, y: 30, photo: "https://via.placeholder.com/60/0a2a5e/white?text=LP" },
    { id: 3, firstName: "Ethan", lastName: "Jacobs", ageGroup: "U15", position: "CB", present: true, paid: true, x: 70, y: 70, photo: "https://via.placeholder.com/60/0b3d2e/white?text=EJ" },
    { id: 4, firstName: "James", lastName: "Mbeki", ageGroup: "U15", position: "GK", present: false, paid: false, x: 20, y: 20, photo: "https://via.placeholder.com/60/0a2a5e/white?text=JM" },
    { id: 5, firstName: "Sipho", lastName: "Dlamini", ageGroup: "U13", position: "LB", present: true, paid: true, x: 40, y: 60, photo: "https://via.placeholder.com/60/0b3d2e/white?text=SD" },
    { id: 6, firstName: "Michael", lastName: "Johnson", ageGroup: "U15", position: "ST", present: false, paid: false, x: 80, y: 40, photo: "https://via.placeholder.com/60/0a2a5e/white?text=MJ" }
];

let currentFormation = "4-4-2";
let draggingPlayer = null;

// Save to localStorage
function saveData() {
    localStorage.setItem("midvaalens_players", JSON.stringify(players));
}

// Load data from localStorage
function loadData() {
    const stored = localStorage.getItem("midvaalens_players");
    if (stored) {
        players = JSON.parse(stored);
    } else {
        saveData();
    }
}

// Show tabs
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Refresh data for the tab
    if (tabName === 'dashboard') updateDashboard();
    if (tabName === 'players') displayPlayers();
    if (tabName === 'cards') displayCards();
    if (tabName === 'formation') drawPitch();
    if (tabName === 'attendance') displayAttendance();
    if (tabName === 'payments') displayPayments();
}

// Update dashboard
function updateDashboard() {
    document.getElementById('totalPlayers').innerText = players.length;
    const presentCount = players.filter(p => p.present).length;
    document.getElementById('presentToday').innerText = presentCount;
    const paidCount = players.filter(p => p.paid).length;
    document.getElementById('paidCount').innerText = paidCount;
}

// Display players in tables
function displayPlayers() {
    const u13Players = players.filter(p => p.ageGroup === "U13");
    const u15Players = players.filter(p => p.ageGroup === "U15");
    
    // U13 Table
    let u13Html = `<thead><tr><th>Name</th><th>Position</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;
    u13Players.forEach(player => {
        u13Html += `
            <tr>
                <td>${player.firstName} ${player.lastName}</td>
                <td>${player.position}</td>
                <td>${player.present ? '✅ Present' : '❌ Absent'}</td>
                <td>
                    <button onclick="togglePresent(${player.id})">Toggle Present</button>
                    <button onclick="deletePlayer(${player.id})">Delete</button>
                </td>
            </tr>
        `;
    });
    u13Html += `</tbody>`;
    document.getElementById('u13Table').innerHTML = u13Html;
    
    // U15 Table
    let u15Html = `<thead><tr><th>Name</th><th>Position</th><th>Status</th><th>Actions</th></tr></thead><tbody>`;
    u15Players.forEach(player => {
        u15Html += `
            <tr>
                <td>${player.firstName} ${player.lastName}</td>
                <td>${player.position}</td>
                <td>${player.present ? '✅ Present' : '❌ Absent'}</td>
                <td>
                    <button onclick="togglePresent(${player.id})">Toggle Present</button>
                    <button onclick="deletePlayer(${player.id})">Delete</button>
                </td>
            </tr>
        `;
    });
    u15Html += `</tbody>`;
    document.getElementById('u15Table').innerHTML = u15Html;
}

// Add new player
function addPlayer() {
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const ageGroup = document.getElementById('ageGroup').value;
    const position = document.getElementById('position').value;
    
    if (!firstName || !lastName) {
        alert("Please enter first and last name");
        return;
    }
    
    const newPlayer = {
        id: Date.now(),
        firstName: firstName,
        lastName: lastName,
        ageGroup: ageGroup,
        position: position,
        present: true,
        paid: false,
        x: Math.random() * 80 + 10,
        y: Math.random() * 80 + 10,
        photo: `https://via.placeholder.com/60/0b3d2e/white?text=${firstName[0]}${lastName[0]}`
    };
    
    players.push(newPlayer);
    saveData();
    
    // Clear form
    document.getElementById('firstName').value = '';
    document.getElementById('lastName').value = '';
    
    // Refresh displays
    displayPlayers();
    updateDashboard();
    displayCards();
    displayAttendance();
    displayPayments();
    drawPitch();
    
    alert("Player added successfully!");
}

// Toggle present status
function togglePresent(playerId) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        player.present = !player.present;
        saveData();
        displayPlayers();
        updateDashboard();
        displayAttendance();
        displayCards();
    }
}

// Toggle payment status
function togglePayment(playerId) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        player.paid = !player.paid;
        saveData();
        displayPayments();
        updateDashboard();
    }
}

// Delete player
function deletePlayer(playerId) {
    if (confirm("Are you sure you want to delete this player?")) {
        players = players.filter(p => p.id !== playerId);
        saveData();
        displayPlayers();
        updateDashboard();
        displayCards();
        displayAttendance();
        displayPayments();
        drawPitch();
    }
}

// Display FIFA-style cards
function displayCards() {
    const cardView = document.getElementById('cardView');
    let html = '';
    
    players.forEach(player => {
        html += `
            <div class="fifa-card">
                <img src="${player.photo}" alt="${player.firstName}">
                <h4>${player.firstName} ${player.lastName}</h4>
                <p>${player.ageGroup} | ${player.position}</p>
                <p>${player.present ? '✅ Present' : '❌ Absent'}</p>
                <div style="background: ${player.paid ? '#4CAF50' : '#f44336'}; padding: 3px; border-radius: 5px;">
                    ${player.paid ? 'Paid ✓' : 'Unpaid ✗'}
                </div>
            </div>
        `;
    });
    
    cardView.innerHTML = html;
}

// Set formation
function setFormation() {
    currentFormation = document.getElementById('formation').value;
    drawPitch();
}

// Draw formation on pitch
function drawPitch() {
    const pitch = document.getElementById('pitch');
    pitch.innerHTML = '';
    
    const formations = {
        '4-4-2': [
            { label: 'GK', x: 50, y: 10 },
            { label: 'LB', x: 15, y: 30 }, { label: 'CB', x: 35, y: 30 }, { label: 'CB', x: 65, y: 30 }, { label: 'RB', x: 85, y: 30 },
            { label: 'LM', x: 15, y: 50 }, { label: 'CM', x: 50, y: 50 }, { label: 'RM', x: 85, y: 50 },
            { label: 'ST', x: 35, y: 80 }, { label: 'ST', x: 65, y: 80 }
        ],
        '4-3-3': [
            { label: 'GK', x: 50, y: 10 },
            { label: 'LB', x: 15, y: 30 }, { label: 'CB', x: 35, y: 30 }, { label: 'CB', x: 65, y: 30 }, { label: 'RB', x: 85, y: 30 },
            { label: 'CM', x: 30, y: 50 }, { label: 'CM', x: 50, y: 50 }, { label: 'CM', x: 70, y: 50 },
            { label: 'LW', x: 15, y: 80 }, { label: 'ST', x: 50, y: 80 }, { label: 'RW', x: 85, y: 80 }
        ],
        '3-5-2': [
            { label: 'GK', x: 50, y: 10 },
            { label: 'CB', x: 25, y: 30 }, { label: 'CB', x: 50, y: 30 }, { label: 'CB', x: 75, y: 30 },
            { label: 'LM', x: 15, y: 50 }, { label: 'CM', x: 50, y: 45 }, { label: 'CM', x: 50, y: 55 }, { label: 'RM', x: 85, y: 50 },
            { label: 'AM', x: 50, y: 65 },
            { label: 'ST', x: 35, y: 85 }, { label: 'ST', x: 65, y: 85 }
        ]
    };
    
    const positions = formations[currentFormation] || formations['4-4-2'];
    
    positions.forEach(pos => {
        const dot = document.createElement('div');
        dot.className = 'player-dot';
        dot.style.left = `calc(${pos.x}% - 20px)`;
        dot.style.top = `calc(${pos.y}% - 20px)`;
        dot.innerHTML = pos.label;
        dot.draggable = false;
        pitch.appendChild(dot);
    });
}

// Display attendance table
function displayAttendance() {
    const table = document.getElementById('attendanceTable');
    let html = `<thead><tr><th>Name</th><th>Age Group</th><th>Status</th><th>Action</th></tr></thead><tbody>`;
    
    players.forEach(player => {
        html += `
            <tr>
                <td>${player.firstName} ${player.lastName}</td>
                <td>${player.ageGroup}</td>
                <td>${player.present ? '✅ Present' : '❌ Absent'}</td>
                <td>
                    <button onclick="togglePresent(${player.id})">Mark ${player.present ? 'Absent' : 'Present'}</button>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody>`;
    table.innerHTML = html;
}

// Display payments table
function displayPayments() {
    const table = document.getElementById('paymentsTable');
    let html = `<thead><tr><th>Name</th><th>Age Group</th><th>Payment Status</th><th>Action</th></tr></thead><tbody>`;
    
    players.forEach(player => {
        html += `
            <tr>
                <td>${player.firstName} ${player.lastName}</td>
                <td>${player.ageGroup}</td>
                <td style="color: ${player.paid ? 'green' : 'red'};">
                    ${player.paid ? '✓ Paid' : '✗ Unpaid'}
                </td>
                <td>
                    <button onclick="togglePayment(${player.id})">
                        Mark ${player.paid ? 'Unpaid' : 'Paid'}
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody>`;
    table.innerHTML = html;
}

// Drag and drop functionality for formation (optional)
function makeDraggable() {
    const dots = document.querySelectorAll('.player-dot');
    dots.forEach(dot => {
        dot.addEventListener('mousedown', startDrag);
    });
}

function startDrag(e) {
    draggingPlayer = e.target;
    e.target.style.opacity = '0.5';
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
}

function drag(e) {
    if (draggingPlayer) {
        const pitch = document.getElementById('pitch');
        const rect = pitch.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        
        x = Math.min(Math.max(x, 0), rect.width);
        y = Math.min(Math.max(y, 0), rect.height);
        
        draggingPlayer.style.left = `calc(${(x/rect.width)*100}% - 20px)`;
        draggingPlayer.style.top = `calc(${(y/rect.height)*100}% - 20px)`;
    }
}

function stopDrag() {
    if (draggingPlayer) {
        draggingPlayer.style.opacity = '1';
        draggingPlayer = null;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }
}

// Initialize everything
function init() {
    loadData();
    updateDashboard();
    displayPlayers();
    displayCards();
    drawPitch();
    displayAttendance();
    displayPayments();
    
    // Add some CSS for tables
    const style = document.createElement('style');
    style.textContent = `
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #0b3d2e;
            color: white;
        }
        button {
            padding: 5px 10px;
            margin: 2px;
            cursor: pointer;
            background-color: #0a2a5e;
            color: white;
            border: none;
            border-radius: 3px;
        }
        button:hover {
            background-color: #0b3d2e;
        }
        .admin-only {
            border-left: 4px solid gold;
        }
        input, select {
            padding: 8px;
            margin: 5px;
            border-radius: 5px;
            border: 1px solid #ccc;
        }
    `;
    document.head.appendChild(style);
}

// Start the app
init();