/**
 * NEXUS NEX MATRIX CORE - PRODUCTION LOUDPLAY ORCHESTRATOR
 * Supports Local Development and Render Persistent Volume Mounts Automatically
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Render assigns dynamic ports. 0.0.0.0 tells Node to accept external web routing.
const PORT = process.env.PORT || 3000; 

// Merchant synchronization configs
const CONFIG_MERCHANT_UPI_ID = "8872791624@fam"; 
const CONFIG_MERCHANT_NAME = "Nexus Cloud Rigs";

app.use(express.static(path.join(__dirname)));
app.use(express.json());

// DETECT ENVIRONMENT & ROUTE DATABASE ROUTING PATHS
const IS_PRODUCTION = process.env.RENDER === "true";
const DB_FILE = IS_PRODUCTION 
    ? '/opt/render/project/src/data/database.json' // Production: Safe Persistent Disk Folder
    : path.join(__dirname, 'database.json');        // Localhost fallback path

// Volatile memory tracking loop for running VM session timeouts
let activeHeartbeatMonitors = {};

/**
 * DATABASE FILE I/O WRAPPERS
 */
function readDatabase() {
    try {
        // Automatically verify directory existence on production volume mount path
        if (IS_PRODUCTION) {
            const dir = path.dirname(DB_FILE);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        if (!fs.existsSync(DB_FILE)) {
            const defaultData = {
                gamertag: "Young Goat",
                isSteamSynced: false,
                steamId: null,
                walletBalance: 0,     
                playtimeMinutes: 0,     
                activeSession: false,
                allocatedVmIp: null,
                allocatedVmId: null,
                usedUTRs: [] 
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(fileContent);
    } catch (err) {
        console.error("Database parsing execution error, falling back to safe cache context:", err);
        return { gamertag: "Young Goat", isSteamSynced: false, steamId: null, walletBalance: 0, playtimeMinutes: 0, activeSession: false, allocatedVmIp: null, allocatedVmId: null, usedUTRs: [] };
    }
}

function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("CRITICAL ERROR: Failed writing metrics to data volume drive layer:", err);
    }
}

/**
 * CORE ACCOUNT MUTATION & AUTH HANDSHAKES
 */
app.get('/api/user-status', (req, res) => {
    res.json(readDatabase());
});

app.post('/api/auth-steam', (req, res) => {
    const { steamId } = req.body;
    let db = readDatabase();

    const steamId64Regex = /^[0-9]{17}$/;
    if (!steamId || !steamId64Regex.test(steamId)) {
        return res.status(400).json({ 
            success: false, 
            message: "Authentication Rejected: Invalid SteamID64 signature format. Sequence must be exactly 17 numerical digits." 
        });
    }

    db.steamId = steamId;
    db.isSteamSynced = true;
    saveDatabase(db);

    res.json({ success: true, steamId: db.steamId });
});

/**
 * BANKING, PAYMENT VERIFICATION & WALLET MUTATORS
 */
app.get('/api/payment-config', (req, res) => {
    res.json({ vpa: CONFIG_MERCHANT_UPI_ID, payeeName: CONFIG_MERCHANT_NAME });
});

app.post('/api/verify-utr', (req, res) => {
    const { utr, amount } = req.body;
    let db = readDatabase();
    const utrRegex = /^\d{12}$/;
    
    if (!utr || !utrRegex.test(utr)) return res.status(400).json({ success: false, message: "Format Error! Bank UTR must contain exactly 12 numerical characters." });
    if (db.usedUTRs.includes(utr)) return res.status(400).json({ success: false, message: "Security Warning! This transaction reference hash has already been processed." });

    db.usedUTRs.push(utr); 
    db.walletBalance += parseInt(amount); 
    saveDatabase(db);
    res.json({ success: true, newBalance: db.walletBalance });
});

app.post('/api/buy-pass', (req, res) => {
    const { cost, minutes } = req.body;
    let db = readDatabase();
    
    if (db.walletBalance < cost) return res.status(400).json({ success: false, message: "Transaction Declined: Insufficient balance in fiat ledger wallet." });

    db.walletBalance -= cost;
    db.playtimeMinutes += minutes;
    saveDatabase(db);
    res.json({ success: true, newBalance: db.walletBalance, newPlaytime: db.playtimeMinutes });
});

/**
 * CLOUD PC PROVISIONING PIPELINE (LOUDPLAY BACKEND ORCHESTRATOR)
 */
app.post('/api/infrastructure/provision', async (req, res) => {
    let db = readDatabase();
    const { gameTemplate } = req.body;

    if (!db.isSteamSynced || !db.steamId) {
        return res.status(403).json({ success: false, message: "Security Block: Steam account linkage verification token is required before mounting infrastructure blades." });
    }
    if (db.playtimeMinutes < 60) {
        return res.status(400).json({ success: false, message: "Allocation Fault: Playtime balance exhausted. Charge hours to allocate a compute engine." });
    }

    try {
        console.log(`[ORCHESTRATOR] Initializing virtual hardware cluster node using disk template profile [${gameTemplate}] for user ID: ${db.steamId}`);
        
        // Mocking successful server image hand-off loop
        const mockAllocatedServerIp = "142.250.190.46"; 
        const mockAllocatedMachineId = "vm_node_rtx4080_stable_sea1";

        db.playtimeMinutes -= 60; 
        db.activeSession = true;
        db.allocatedVmIp = mockAllocatedServerIp;
        db.allocatedVmId = mockAllocatedMachineId;
        saveDatabase(db);

        // Turn on running node monitoring watchdog
        initializeActiveNodeWatchdog(mockAllocatedMachineId);

        res.json({ 
            success: true, 
            streamUrl: `https://${mockAllocatedServerIp}:47990`, 
            newPlaytime: db.playtimeMinutes,
            message: "Target infrastructure node is warm and routing video frames." 
        });

    } catch (error) {
        console.error("Infrastructure provisioning communication timeout:", error);
        res.status(500).json({ success: false, message: "Critical infrastructure exception during instance orchestration." });
    }
});

/**
 * LIVING CLIENT ROUTINE KEEPALIVE TICK (WATCHDOG DETECTOR)
 */
app.post('/api/infrastructure/heartbeat', (req, res) => {
    const { vmId } = req.body;
    
    if (vmId && activeHeartbeatMonitors[vmId]) {
        activeHeartbeatMonitors[vmId].unansweredTicksCount = 0;
        return res.json({ status: "acknowledged", message: "Keepalive verified." });
    }
    res.status(404).json({ status: "stale", message: "Target container frame tracker context has exited memory pools." });
});

/**
 * HARD SHUTDOWN PROCESS MATRIX
 */
app.post('/api/terminate-session', async (req, res) => {
    let db = readDatabase();
    const targetVmId = db.allocatedVmId;

    console.log(`[ORCHESTRATOR] Tearing down instance target container ${targetVmId}`);
    
    if (targetVmId && activeHeartbeatMonitors[targetVmId]) {
        clearInterval(activeHeartbeatMonitors[targetVmId].timerHandle);
        delete activeHeartbeatMonitors[targetVmId];
    }

    db.activeSession = false;
    db.allocatedVmIp = null;
    db.allocatedVmId = null;
    saveDatabase(db);
    
    res.json({ success: true, message: "Virtual node connection pipeline released." });
});

/**
 * SYSTEM TIMEOUT WATCHDOG FUNCTION
 */
function initializeActiveNodeWatchdog(vmId) {
    if (activeHeartbeatMonitors[vmId]) return;

    activeHeartbeatMonitors[vmId] = {
        unansweredTicksCount: 0,
        timerHandle: setInterval(async () => {
            activeHeartbeatMonitors[vmId].unansweredTicksCount++;
            
            // Shut down container dynamically if user leaves or browser tabs close for 2 mins (4 ticks)
            if (activeHeartbeatMonitors[vmId].unansweredTicksCount >= 4) {
                console.log(`[WATCHDOG AUTOMATION] Client signal lost on VM [${vmId}]. Initiating automatic emergency teardown script.`);
                
                clearInterval(activeHeartbeatMonitors[vmId].timerHandle);
                delete activeHeartbeatMonitors[vmId];

                let db = readDatabase();
                db.activeSession = false;
                db.allocatedVmIp = null;
                db.allocatedVmId = null;
                saveDatabase(db);
            }
        }, 30000) // Sweeps metrics every 30 seconds
    };
}

/**
 * UI INTERFACE FILE SYSTEM PATH ROUTER LINKS
 */
app.get('/pages/game.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'game.html')));
app.get('/pages/login.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'login.html')));
app.get('/pages/pricing.html', (req, res) => res.sendFile(path.join(__dirname, 'pages', 'pricing.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n================================================================`);
    console.log(`🚀 NEXUS LOUDPLAY CLOUD CORE ENGINE RUNNING ON ENVIRONMENT PORT: ${PORT}`);
    console.log(`================================================================\n`);
});