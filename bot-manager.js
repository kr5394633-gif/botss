// Multi-Bot Manager - 30 Bots
const { spawn } = require('child_process');
const path = require('path');

// Set FFmpeg path for manager
const ffmpegStatic = require('ffmpeg-static');
const ffmpegDir = path.dirname(ffmpegStatic);
process.env.PATH = ffmpegDir + path.delimiter + process.env.PATH;

console.log('[BOT MANAGER] FFmpeg directory:', ffmpegDir);

// Start sync coordinator
let shuttingDown = false;
let syncProcess;

function startSyncCoordinator() {
    console.log('[BOT MANAGER] Starting sync coordinator...');
    syncProcess = spawn('node', [path.join(__dirname, 'sync-coordinator.js')], {
        env: {
            ...process.env,
            PATH: process.env.PATH
        },
        stdio: 'inherit'
    });

    syncProcess.on('error', (err) => {
        console.error('[BOT MANAGER] Sync coordinator error:', err.message);
    });

    syncProcess.on('exit', (code, signal) => {
        if (!shuttingDown) {
            console.error(`[BOT MANAGER] Sync coordinator exited (${code || signal}); restarting...`);
            setTimeout(startSyncCoordinator, 2000);
        }
    });
}

function getBotTokens() {
    const configuredTokens = process.env.BOT_TOKENS || process.env.BOT_TOKEN;
    if (!configuredTokens) {
        throw new Error('Set BOT_TOKEN or BOT_TOKENS in Railway Variables');
    }

    try {
        const tokens = configuredTokens.trim().startsWith('[')
            ? JSON.parse(configuredTokens)
            : configuredTokens.split(',').map(token => token.trim());
        if (!Array.isArray(tokens) || tokens.length === 0 || tokens.some(token => !token)) {
            throw new Error('Token list is empty or invalid');
        }
        return tokens;
    } catch (error) {
        throw new Error(`Invalid BOT_TOKENS value: ${error.message}`);
    }
}

const BOT_TOKENS = getBotTokens();

startSyncCoordinator();

const bots = [];

function startBot(token, index) {
    console.log(`[BOT MANAGER] Launching Bot ${index + 1}...`);

    const botProcess = spawn('node', [path.join(__dirname, 'bot-instance.js')], {
        env: {
            ...process.env,
            BOT_TOKEN: token,
            BOT_ID: index + 1,
            PATH: process.env.PATH
        },
        stdio: 'inherit'
    });

    botProcess.on('error', (err) => {
        console.error(`[BOT MANAGER] Bot ${index + 1} error:`, err.message);
    });

    botProcess.on('exit', (code, signal) => {
        if (!shuttingDown) {
            console.error(`[BOT MANAGER] Bot ${index + 1} exited (${code || signal}); restarting...`);
            setTimeout(() => startBot(token, index), 2000);
        }
    });

    bots.push({
        id: index + 1,
        process: botProcess
    });
}

console.log(`[BOT MANAGER] Starting ${BOT_TOKENS.length} bot instances...`);

BOT_TOKENS.forEach((token, index) => {
    startBot(token, index);
});

// Graceful shutdown
process.on('SIGINT', () => {
    shuttingDown = true;
    console.log('\n[BOT MANAGER] Shutting down sync coordinator...');
    if (syncProcess) syncProcess.kill();
    
    console.log('[BOT MANAGER] Shutting down all bots...');
    bots.forEach(bot => {
        bot.process.kill();
    });
    process.exit(0);
});

console.log('[BOT MANAGER] All bots launched. Press Ctrl+C to stop all.');
