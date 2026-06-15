const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000; 

// 🔥 CONFIGURATION: Your live active UPI ID and business name
const CONFIG_MERCHANT_UPI_ID = "8872791624@fam"; 
const CONFIG_MERCHANT_NAME = "CloudRigs Arcade";

app.use(express.static(path.join(__dirname)));
app.use(express.json());

const DB_FILE = path.join(__dirname, 'database.json');

// Helper Function: Read data from your database file safely
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
                usedUTRs: [] // Tracks all successfully claimed 12-digit transaction numbers
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        let parsed = JSON.parse(fileContent);
        if (!parsed.usedUTRs) parsed.usedUTRs = []; // Fail-safe check
        return parsed;
    } catch (err) {
        return { gamertag: "Young Goat", walletBalance: 0, playtimeMinutes: 0, activeSession: false, usedUTRs: [] };
    }
}

// Helper Function: Write and save data securely to disk storage
function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Critical database save failure:", err);
    }
}

// ==========================================
//           SERVER API ENDPOINTS
// ==========================================

app.get('/api/user-status', (req, res) => {
    res.json(readDatabase());
});

app.get('/api/payment-config', (req, res) => {
    res.json({
        vpa: CONFIG_MERCHANT_UPI_ID,
        payeeName: CONFIG_MERCHANT_NAME
    });
});

// 🔥 NEW: Validates the 12-Digit UTR structure and checks for duplicates
app.post('/api/verify-utr', (req, res) => {
    const { utr, amount } = req.body;
    let session = readDatabase();

    // 1. Structural Check: Must be exactly 12 numeric digits
    const utrRegex = /^\d{12}$/;
    if (!utr || !utrRegex.test(utr)) {
        return res.status(400).json({ 
            success: false, 
            message: "Invalid UTR Format! A valid UPI Ref No. / UTR must be exactly 12 digits long." 
        });
    }

    // 2. Anti-Cheat Check: Has this UTR been claimed before?
    if (session.usedUTRs.includes(utr)) {
        return res.status(400).json({ 
            success: false, 
            message: "Transaction Rejected! This UTR has already been claimed and used." 
        });
    }

    // 3. Process the Claim
    session.usedUTRs.push(utr); // Lock this UTR forever
    session.walletBalance += parseInt(amount); // Credit their cash container
    saveDatabase(session);

    res.json({ 
        success: true, 
        message: "Payment verified successfully!", 
        newBalance: session.walletBalance 
    });
});

app.post('/api/buy-pass', (req, res) => {
    const { cost, minutes } = req.body;
    let session = readDatabase();

    if (session.walletBalance < cost) {
        return res.status(400).json({ 
            success: false, 
            message: `Insufficient Cash! You need ₹${cost} to activate this pass.` 
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

// ROUTING RE-DIRECTIONS
app.get('/pages/game.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'game.html')));
app.get('/pages/login.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'login.html')));
app.get('/pages/pricing.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'pricing.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`🚀 Production Core Active on Port: ${PORT}`));