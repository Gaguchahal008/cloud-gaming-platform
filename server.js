const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Uses environment port on Render, or 3000 locally
const PORT = process.env.PORT || 3000; 

// 🔥 CONFIGURATION: Your direct active mobile UPI handle
const CONFIG_MERCHANT_UPI_ID = "8872791624@fam"; 
const CONFIG_MERCHANT_NAME = "CloudRigs Arcade";

app.use(express.static(path.join(__dirname)));
app.use(express.json());

const DB_FILE = path.join(__dirname, 'database.json');

// Safely reads state configurations from disk storage
function readDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const defaultData = {
                gamertag: "Young Goat",
                isSteamSynced: false,
                steamId: null,
                walletBalance: 0,     
                playtimeMinutes: 0,     
                activeSession: false,
                usedUTRs: [] 
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        let parsed = JSON.parse(fileContent);
        if (!parsed.usedUTRs) parsed.usedUTRs = []; 
        return parsed;
    } catch (err) {
        return { gamertag: "Young Goat", walletBalance: 0, playtimeMinutes: 0, activeSession: false, usedUTRs: [] };
    }
}

// Commits runtime updates securely back to disk
function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Critical database file commit error:", err);
    }
}

// ==========================================
//           SERVER API ENDPOINTS
// ==========================================

app.get('/api/user-status', (req, res) => {
    res.json(readDatabase());
});

app.get('/api/payment-config', (req, res) => {
    res.json({ vpa: CONFIG_MERCHANT_UPI_ID, payeeName: CONFIG_MERCHANT_NAME });
});

// Validates the 12-Digit UTR structure and acts as anti-cheat lock
app.post('/api/verify-utr', (req, res) => {
    const { utr, amount } = req.body;
    let session = readDatabase();

    const utrRegex = /^\d{12}$/;
    if (!utr || !utrRegex.test(utr)) {
        return res.status(400).json({ 
            success: false, 
            message: "Invalid UTR Format! A valid UPI Ref No. must be exactly 12 numeric digits." 
        });
    }

    if (session.usedUTRs.includes(utr)) {
        return res.status(400).json({ 
            success: false, 
            message: "Transaction Rejected! This unique UTR has already been claimed." 
        });
    }

    session.usedUTRs.push(utr); 
    session.walletBalance += parseInt(amount); 
    saveDatabase(session);

    res.json({ success: true, newBalance: session.walletBalance });
});

app.post('/api/buy-pass', (req, res) => {
    const { cost, minutes } = req.body;
    let session = readDatabase();

    if (session.walletBalance < cost) {
        return res.status(400).json({ 
            success: false, 
            message: `Insufficient Cash! You need ₹${cost} to complete this conversion pass.` 
        });
    }

    session.walletBalance -= cost;
    session.playtimeMinutes += minutes;
    saveDatabase(session);

    res.json({ success: true, newBalance: session.walletBalance, newPlaytime: session.playtimeMinutes });
});

app.post('/api/launch-game', (req, res) => {
    const { gameName } = req.body;
    let session = readDatabase();

    if (session.playtimeMinutes < 60) {
        return res.status(400).json({ success: false, message: "Insufficient Playtime! Re-up your pass minutes." });
    }

    session.playtimeMinutes -= 60; 
    session.activeSession = true;
    saveDatabase(session);
    res.json({ success: true, newPlaytime: session.playtimeMinutes });
});

app.post('/api/terminate-session', (req, res) => {
    let session = readDatabase();
    session.activeSession = false;
    saveDatabase(session);
    res.json({ success: true });
});

app.post('/api/update-profile', (req, res) => {
    const { gamertag } = req.body;
    if (gamertag && gamertag.trim() !== "") {
        let session = readDatabase();
        session.gamertag = gamertag.trim();
        saveDatabase(session);
        return res.json({ success: true, gamertag: session.gamertag });
    }
    res.status(400).json({ success: false });
});

// SUB-FOLDER ROUTING RE-DIRECTIONS
app.get('/pages/game.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'game.html')));
app.get('/pages/login.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'login.html')));
app.get('/pages/pricing.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'pricing.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`🚀 Playtime Engine Active on Port: ${PORT}`));