// Synchronized Music Coordinator
// All bots connect to this to sync playback

const net = require('net');
const fs = require('fs');
const path = require('path');

const SOCKET_PATH = process.platform === 'win32' 
    ? '\\\\.\\pipe\\discord-bots-sync' 
    : '/tmp/discord-bots-sync.sock';

class SyncCoordinator {
    constructor() {
        this.server = null;
        this.clients = new Map();
        this.lastPlayCommand = null;
        this.startTime = null;
    }

    start() {
        // Clean up old socket
        if (process.platform !== 'win32' && fs.existsSync(SOCKET_PATH)) {
            fs.unlinkSync(SOCKET_PATH);
        }

        this.server = net.createServer((socket) => {
            const clientId = Date.now() + Math.random();
            this.clients.set(clientId, socket);

            console.log(`[SYNC] Bot connected. Total connected: ${this.clients.size}`);

            socket.on('data', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(clientId, message);
                } catch (err) {
                    console.error('[SYNC] Parse error:', err.message);
                }
            });

            socket.on('end', () => {
                this.clients.delete(clientId);
                console.log(`[SYNC] Bot disconnected. Total connected: ${this.clients.size}`);
            });

            socket.on('error', (err) => {
                console.error('[SYNC] Socket error:', err.message);
                this.clients.delete(clientId);
            });
        });

        this.server.listen(SOCKET_PATH, () => {
            console.log('[SYNC] Coordinator listening on', SOCKET_PATH);
        });
    }

    handleMessage(clientId, message) {
        if (message.type === 'PLAY') {
            this.startTime = Date.now() + 8000; // Allow every bot to join and prepare its audio resource
            this.lastPlayCommand = {
                url: message.url,
                title: message.title,
                startTime: this.startTime
            };

            console.log(`[SYNC] Play command from bot. Starting all bots at: ${new Date(this.startTime).toISOString()}`);
            this.broadcastToAll({
                type: 'PLAY_SYNC',
                url: message.url,
                title: message.title,
                channelId: message.channelId,
                startTime: this.startTime
            });
        }
    }

    broadcastToAll(message) {
        const data = JSON.stringify(message) + '\n';
        this.clients.forEach((socket) => {
            if (socket.writable) {
                socket.write(data);
            }
        });
    }
}

const coordinator = new SyncCoordinator();
coordinator.start();

module.exports = coordinator;
