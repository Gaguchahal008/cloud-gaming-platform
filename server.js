const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000; 

app.use(express.static(path.join(__dirname)));
app.use(express.json());

const DB_FILE = path.join(__dirname, 'database.json');

// Helper Function: Read data from your database file
function readDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const defaultData = {
                gamertag: "Young Goat",
                isSteamSynced: false,
                steamId: null,
                playtimeMinutes: 60, // Users start with 60 free minutes of trial playtime
                activeSession: false
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(fileContent);
    } catch (err) {
        return { gamertag: "Young Goat", isSteamSynced: false, steamId: null, playtimeMinutes: 60, activeSession: false };
    }
}

function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Critical: Could not commit changes to disk storage:", err);
    }
}

// ==========================================
//           SERVER API ENDPOINTS
// ==========================================

app.get('/api/user-status', (req, res) => {
    res.json(readDatabase());
});

app.post('/api/update-profile', (req, res) => {
    const { gamertag } = req.body;
    if (gamertag && gamertag.trim() !== "") {
        let session = readDatabase();
        session.gamertag = gamertag.trim();
        saveDatabase(session);
        return res.json({ success: true, gamertag: session.gamertag });
    }
    res.status(400).json({ success: false, message: "Invalid identity parameters." });
});

// Endpoint: Adds exact playtime blocks based on purchased packages
app.post('/api/add-playtime', (req, res) => {
    const { minutes } = req.body;
    if (minutes && !isNaN(minutes)) {
        let session = readDatabase();
        session.playtimeMinutes += parseInt(minutes);
        saveDatabase(session);
        return res.json({ success: true, newPlaytime: session.playtimeMinutes });
    }
    res.status(400).json({ success: false, message: "Invalid package allocation parameters." });
});

// Endpoint: Deducts exactly 60 minutes when a game stream initializes
app.post('/api/launch-game', (req, res) => {
    const { gameName } = req.body;
    let session = readDatabase();

    if (session.playtimeMinutes < 60) {
        return res.status(400).json({ success: false, message: "Insufficient Playtime! You need at least 60 mins remaining." });
    }

    session.playtimeMinutes -= 60; // Consume exactly 1 hour of their total playtime bank
    session.activeSession = true;
    saveDatabase(session);
    res.json({ success: true, message: `Streaming rig launched for ${gameName}!`, newPlaytime: session.playtimeMinutes });
});

app.post('/api/terminate-session', (req, res) => {
    let session = readDatabase();
    session.activeSession = false;
    saveDatabase(session);
    res.json({ success: true, message: "Session closed safely." });
});

// ==========================================
//          ROUTING CONFIGURATIONS
// ==========================================
app.get('/pages/game.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'game.html')));
app.get('/pages/login.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'login.html')));
app.get('/pages/pricing.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'pricing.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
    console.log(`🚀 Playtime Engine Active on Port: ${PORT}`);
});