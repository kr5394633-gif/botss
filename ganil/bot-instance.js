// Set FFmpeg path
const ffmpegStatic = require('ffmpeg-static');
process.env.PATH = require('path').dirname(ffmpegStatic) + require('path').delimiter + process.env.PATH;

const net = require('net');
const { Readable } = require('stream');
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, AudioPlayerStatus, StreamType, VoiceConnectionStatus } = require("@discordjs/voice");
const { FFmpeg } = require("prism-media");
const youtubedl = require("youtube-dl-exec");

// ─── BOT TOKEN FROM ENVIRONMENT ───
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_ID = process.env.BOT_ID || "1";
const PREFIX = "!";

// ─── SYNC COORDINATOR CONNECTION ───
const SOCKET_PATH = process.platform === 'win32' 
    ? '\\\\.\\pipe\\discord-bots-sync' 
    : '/tmp/discord-bots-sync.sock';

let syncSocket = null;
let pendingSyncPlay = null;

function connectToSync() {
    syncSocket = net.createConnection(SOCKET_PATH, () => {
        console.log(`[BOT ${BOT_ID}] Connected to sync coordinator`);
    });

    syncSocket.on('data', (data) => {
        try {
            const message = JSON.parse(data.toString());
            handleSyncMessage(message).catch((err) => {
                console.error(`[BOT ${BOT_ID}] Sync playback error:`, err.message);
            });
        } catch (err) {
            console.error(`[BOT ${BOT_ID}] Sync parse error:`, err.message);
        }
    });

    syncSocket.on('error', (err) => {
        console.error(`[BOT ${BOT_ID}] Sync error:`, err.message);
        // Retry connection after 2 seconds
        setTimeout(connectToSync, 2000);
    });

    syncSocket.on('end', () => {
        console.log(`[BOT ${BOT_ID}] Sync disconnected, reconnecting...`);
        setTimeout(connectToSync, 2000);
    });
}

function sendSyncMessage(message) {
    if (syncSocket && syncSocket.writable) {
        syncSocket.write(JSON.stringify(message) + '\n');
    }
}

async function handleSyncMessage(message) {
    if (message.type === 'PLAY_SYNC') {
        console.log(`[BOT ${BOT_ID}] [SYNC] Received play sync command: ${message.title}`);
        if (message.channelId) {
            await ensureVoiceConnection(message.channelId);
        }
        pendingSyncPlay = {
            url: message.url,
            title: message.title,
            startTime: message.startTime,
            resource: await createAudioResourceFromUrl(message.url, isBassboosted, blastMode, pungiMode)
        };

        // Calculate delay
        const delay = Math.max(0, message.startTime - Date.now());
        console.log(`[BOT ${BOT_ID}] [SYNC] Will play in ${delay}ms`);

        setTimeout(() => {
            if (pendingSyncPlay && currentConnection && currentConnection.state.status === VoiceConnectionStatus.Ready) {
                console.log(`[BOT ${BOT_ID}] [SYNC] NOW PLAYING SYNCHRONIZED: ${pendingSyncPlay.title}`);
                currentUrl = pendingSyncPlay.url;
                currentTitle = pendingSyncPlay.title;
                activeResource = pendingSyncPlay.resource;
                audioPlayer.play(activeResource);
                currentConnection.subscribe(audioPlayer);
                pendingSyncPlay = null;
            } else if (pendingSyncPlay) {
                console.error(`[BOT ${BOT_ID}] [SYNC] Voice connection was not ready at playback time`);
            }
        }, delay);
    }
}

// Connect to sync coordinator
connectToSync();

if (!BOT_TOKEN) {
    console.error(`[BOT ${BOT_ID}] ERROR: No BOT_TOKEN provided`);
    process.exit(1);
}

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let currentConnection = null;
const audioPlayer = createAudioPlayer();
let currentUrl = null;
let isBassboosted = false;
let currentVolumeMultiplier = 1.0;
let activeResource = null;
let currentChannelId = null;
let currentTitle = "Unknown";

// ─── AUDIO MODES ───
let loudMode = false;
let loudModeBoost = 2.0;
let loudModeMaxVolume = 10.0;
let loudModeInterval = null;
let blastMode = false;
let blastVolume = 50.0;
let pungiMode = false;
let pungiIntensity = 100.0;
let loopMode = false;

// ─── UTILITY FUNCTIONS ───
function isYouTubeUrl(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}

async function getAudioUrl(url) {
    if (isYouTubeUrl(url)) {
        try {
            console.log(`[BOT ${BOT_ID}] Fetching YouTube: ${url}`);
            const result = await youtubedl(url, {
                dumpSingleJson: true,
                noPlaylist: true,
                format: 'bestaudio[ext=webm]/bestaudio/best',
                noWarnings: true,
                extractorArgs: 'youtube:player_client=android,web_safari'
            });
            console.log(`[BOT ${BOT_ID}] YouTube fetch success: ${result.title}`);
            return {
                url: result.url,
                title: result.title || "YouTube Audio",
                isYouTube: true
            };
        } catch (err) {
            console.error(`[BOT ${BOT_ID}] YouTube DL Error:`, err.message);
            throw new Error(`YouTube download failed: ${err.message}`);
        }
    } else {
        console.log(`[BOT ${BOT_ID}] Using direct stream: ${url}`);
        return {
            url: url,
            title: "Direct Stream",
            isYouTube: false
        };
    }
}

async function createAudioResourceFromUrl(audioUrl, bassboosted, blast = false, pungi = false) {
    let finalStream = audioUrl;
    let audioFilters = [];

    if (bassboosted) {
        audioFilters.push("equalizer=f=60:width_type=h:width=50:g=15");
    }

    if (pungi) {
        audioFilters.push("acrusher=bits=4:mode=log:aa=1");
        audioFilters.push("equalizer=f=30:width_type=h:width=80:g=20");
        audioFilters.push("equalizer=f=100:width_type=h:width=100:g=15");
        audioFilters.push("loudnorm=I=-1:TP=0:LRA=1");
        audioFilters.push(`volume=${pungiIntensity}`);
    } else if (blast) {
        audioFilters.push("loudnorm=I=-5:TP=0:LRA=1");
        audioFilters.push("volume=20.0");
        audioFilters.push("dynaudnorm=p=0.9:m=50.0:g=15");
    } else {
        audioFilters.push("loudnorm");
    }

    const filterString = audioFilters.join(",");

    if (bassboosted || blast || pungi) {
        const ffmpeg = new FFmpeg({
            args: [
                "-reconnect", "1",
                "-reconnect_streamed", "1",
                "-reconnect_delay_max", "5",
                "-analyzeduration", "0",
                "-loglevel", "error",
                "-i", audioUrl,
                "-af", filterString,
                "-f", "s16le",
                "-ar", "48000",
                "-ac", "2"
            ],
            shell: false
        });
        finalStream = ffmpeg;
    }

    if (!bassboosted && !blast && !pungi) {
        const response = await fetch(audioUrl);
        if (!response.ok || !response.body) {
            throw new Error(`Audio stream request failed with status ${response.status}`);
        }
        finalStream = Readable.fromWeb(response.body);
    }

    const resource = createAudioResource(finalStream, {
        inputType: (bassboosted || blast || pungi) ? StreamType.Raw : StreamType.Arbitrary,
        inlineVolume: true
    });

    let vol = blastMode ? Math.min(blastVolume, 100.0) : (pungiMode ? Math.min(pungiIntensity, 100.0) : currentVolumeMultiplier);
    resource.volume.setVolume(vol);
    return resource;
}

async function playAudio(url, title, isYouTube) {
    if (!currentConnection) return;
    
    currentUrl = url;
    currentTitle = title;
    activeResource = await createAudioResourceFromUrl(url, isBassboosted, blastMode, pungiMode);
    audioPlayer.play(activeResource);
    currentConnection.subscribe(audioPlayer);

    console.log(`[BOT ${BOT_ID}] Now playing: ${title}`);
}

function stopLoudMode() {
    if (loudModeInterval) {
        clearInterval(loudModeInterval);
        loudModeInterval = null;
    }
    loudMode = false;
}

function attachConnectionEvents(connection) {
    connection.on(VoiceConnectionStatus.Ready, () => {
        console.log(`[BOT ${BOT_ID}] Connected to voice channel`);
    });
    connection.on(VoiceConnectionStatus.Disconnected, () => {
        console.log(`[BOT ${BOT_ID}] Disconnected`);
    });
    connection.on(VoiceConnectionStatus.Destroyed, () => {
        console.log(`[BOT ${BOT_ID}] Connection destroyed`);
        currentConnection = null;
        currentChannelId = null;
        stopLoudMode();
    });
}

async function ensureVoiceConnection(channelId) {
    if (currentConnection && currentChannelId === channelId) {
        return;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
        throw new Error('Synchronized voice channel is unavailable');
    }

    if (currentConnection) {
        audioPlayer.stop();
        currentConnection.destroy();
    }

    currentConnection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfMute: false,
        selfDeaf: false
    });
    attachConnectionEvents(currentConnection);
    currentChannelId = channel.id;
    try {
        await entersState(currentConnection, VoiceConnectionStatus.Ready, 30000);
    } catch (error) {
        currentConnection.destroy();
        currentConnection = null;
        currentChannelId = null;
        throw new Error(`Voice connection failed: ${error.message}`);
    }
}

// ─── EVENTS ───
audioPlayer.on(AudioPlayerStatus.Playing, () => {
    console.log(`[BOT ${BOT_ID}] Playing...`);
});

audioPlayer.on(AudioPlayerStatus.Idle, () => {
    if (loopMode && currentUrl && currentConnection) {
        console.log(`[BOT ${BOT_ID}] Looping: ${currentTitle}`);
        setTimeout(() => {
            playAudio(currentUrl, currentTitle, isYouTubeUrl(currentUrl));
        }, 500);
    }
});

audioPlayer.on("error", (error) => {
    console.error(`[BOT ${BOT_ID}] Player error: ${error.message}`);
});

client.on("ready", () => {
    console.log(`\n[BOT ${BOT_ID}] ✅ Logged in as: ${client.user.tag}`);
    console.log(`[BOT ${BOT_ID}] Ready to accept commands!`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        // LOOP
        if (command === "loop") {
            loopMode = !loopMode;
            return message.reply(`[BOT ${BOT_ID}] Loop: ${loopMode ? "ON" : "OFF"}`);
        }

        // BLAST
        if (command === "blast") {
            blastMode = !blastMode;
            pungiMode = false;
            return message.reply(`[BOT ${BOT_ID}] Blast Mode: ${blastMode ? "🔥 ON" : "OFF"}`);
        }

        // VOLUME
        if (command === "volume") {
            const vol = parseInt(args[0], 10);
            if (isNaN(vol) || vol < 1 || vol > 10000) {
                return message.reply("[ERROR] Volume must be 1-10000");
            }
            currentVolumeMultiplier = vol / 100;
            return message.reply(`[BOT ${BOT_ID}] Volume: ${vol}%`);
        }

        // PLAY
        if (command === "play") {
            const audioUrl = args.join(" ");
            if (!audioUrl.startsWith('http')) {
                return message.reply("[ERROR] Please provide a valid URL");
            }
            if (!currentConnection) {
                return message.reply("[ERROR] Join a voice channel first");
            }
            await message.reply(`[BOT ${BOT_ID}] ⏳ Fetching stream...`);
            try {
                const { url, title, isYouTube } = await getAudioUrl(audioUrl);
                
                // Send sync command to coordinator
                console.log(`[BOT ${BOT_ID}] [SYNC] Sending play command to coordinator`);
                sendSyncMessage({
                    type: 'PLAY',
                    url: url,
                    title: title,
                    channelId: currentChannelId
                });
                
                await message.reply(`[BOT ${BOT_ID}] 🎵 Queued for synchronized playback: ${title}`);
            } catch (err) {
                return message.reply(`[ERROR] ${err.message}`);
            }
            return;
        }

        // JOIN
        if (command === "join") {
            const channelId = args[0];
            if (!channelId) {
                return message.reply("[ERROR] Provide channel ID");
            }
            try {
                const channel = await client.channels.fetch(channelId);
                if (!channel || channel.type !== ChannelType.GuildVoice) {
                    return message.reply("[ERROR] Not a voice channel");
                }
                if (currentConnection) {
                    audioPlayer.stop();
                    currentConnection.destroy();
                }
                currentConnection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfMute: false,
                    selfDeaf: false
                });
                attachConnectionEvents(currentConnection);
                currentChannelId = channel.id;
                message.reply(`[BOT ${BOT_ID}] ✅ Joined: ${channel.name}`);
            } catch (err) {
                message.reply(`[ERROR] ${err.message}`);
            }
            return;
        }

        // LEAVE
        if (command === "leave") {
            if (currentConnection) {
                audioPlayer.stop();
                currentConnection.destroy();
                return message.reply(`[BOT ${BOT_ID}] Left channel`);
            }
            return message.reply("[ERROR] Not in a channel");
        }

        // STOP
        if (command === "stop") {
            audioPlayer.stop();
            return message.reply(`[BOT ${BOT_ID}] Stopped`);
        }

        // PAUSE
        if (command === "pause") {
            if (audioPlayer.state.status === AudioPlayerStatus.Playing) {
                audioPlayer.pause();
                return message.reply(`[BOT ${BOT_ID}] Paused`);
            }
            return message.reply("[ERROR] Not playing");
        }

        // RESUME
        if (command === "resume") {
            if (audioPlayer.state.status === AudioPlayerStatus.Paused) {
                audioPlayer.unpause();
                return message.reply(`[BOT ${BOT_ID}] Resumed`);
            }
            return message.reply("[ERROR] Not paused");
        }

    } catch (err) {
        console.error(`[BOT ${BOT_ID}] Error:`, err);
        message.reply(`[ERROR] ${err.message}`).catch(console.error);
    }
});

client.login(BOT_TOKEN).catch((error) => {
    console.error(`[BOT ${BOT_ID}] Login failed: ${error.message}`);
    process.exit(1);
});
