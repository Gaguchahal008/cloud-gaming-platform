const express = require('express');
const path = require('path');
const fs = require('fs'); // Core Node module to handle files on the hard drive
const app = express();

// CRITICAL FOR DEPLOYMENT: Uses the internet provider's dynamic port, or 3000 locally
const PORT = process.env.PORT || 3000; 

app.use(express.static(path.join(__dirname)));
app.use(express.json());

const DB_FILE = path.join(__dirname, 'database.json');

// Helper Function: Read data from your database file
function readDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            // Create default profile data if database doesn't exist yet
            const defaultData = {
                isSteamSynced: false,
                steamId: null,
                walletBalance: 250, 
                activeSession: false
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(fileContent);
    } catch (err) {
        console.error("Error reading database file, returning basic memory state:", err);
        return { isSteamSynced: false, steamId: null, walletBalance: 250, activeSession: false };
    }
}

// Helper Function: Write and save data securely to your database file
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

// Endpoint: Returns current state variables (Wallet, Sync Status)
app.get('/api/user-status', (req, res) => {
    res.json(readDatabase());
});

// Endpoint: Handles fake Steam account linkage simulation
app.post('/api/sync-steam', (req, res) => {
    let session = readDatabase();
    session.isSteamSynced = true;
    session.steamId = "76561198032145678"; // Generates a mock SteamID64
    saveDatabase(session);
    res.json({ success: true, message: "Steam Connected & State Saved!", steamId: session.steamId });
});

// Endpoint: Process balance increments via portal deposits
app.post('/api/add-funds', (req, res) => {
    const { amount } = req.body;
    if (amount && !isNaN(amount)) {
        let session = readDatabase();
        session.walletBalance += parseInt(amount);
        saveDatabase(session);
        return res.json({ success: true, newBalance: session.walletBalance });
    }
    res.status(400).json({ success: false, message: "Invalid payload parameters." });
});

// Endpoint: Deducts funds and checks parameters for gaming allocations
app.post('/api/launch-game', (req, res) => {
    const { gameName } = req.body;
    let session = readDatabase();

    if (session.walletBalance < 100) {
        return res.status(400).json({ success: false, message: "Low Balance! Minimum ₹100 required per hour." });
    }

    session.walletBalance -= 100; // Deducts exactly 100 per hour session block
    session.activeSession = true;
    saveDatabase(session);
    res.json({ success: true, message: `Streaming instance active for ${gameName}!`, newBalance: session.walletBalance });
});

// Endpoint: Mark streaming session inactive and free up server hardware capacity
app.post('/api/terminate-session', (req, res) => {
    let session = readDatabase();
    session.activeSession = false;
    saveDatabase(session);
    res.json({ success: true, message: "Session stopped safely. Cloud states committed." });
});

// ==========================================
//          PAGES SUB-FOLDER ROUTING
// ==========================================
app.get('/pages/game.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'game.html')));
app.get('/pages/login.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'login.html')));
app.get('/pages/pricing.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'pricing.html')));

// Direct fallback route to handle the main landing interface
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server using the dynamic deployment port configuration
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Storage Server Active on Port: ${PORT}`);
    console.log(`🔗 Local Testing Link: http://localhost:${PORT}`);
    console.log(`====================================================`);
});