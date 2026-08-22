// Set FFmpeg path
const ffmpegStatic = require('ffmpeg-static');
process.env.PATH = require('path').dirname(ffmpegStatic) + require('path').delimiter + process.env.PATH;

const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, VoiceConnectionStatus } = require("@discordjs/voice");
const { FFmpeg } = require("prism-media");
const youtubedl = require("youtube-dl-exec");

// ─── BOT TOKEN ───
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    throw new Error('Set BOT_TOKEN before starting the legacy client');
}
const PREFIX = "!"; // Command prefix

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

// ─── LOUD MODE SETTINGS ───
let loudMode = false;
let loudModeBoost = 2.0;
let loudModeMaxVolume = 10.0;
let loudModeInterval = null;

// ─── VOICE SETTINGS ───
let echoCancellation = true;
let noiseSuppression = true;
let voiceMode = "default";

// ─── BLAST MODE ───
let blastMode = false;
let blastVolume = 50.0;

// ─── PUNGI MODE (EXTREME SNAKE CHARMER) ───
let pungiMode = false;
let pungiIntensity = 100.0; // 10000% default

// ─── LOOP FEATURE ───
let loopMode = false;

// ─── CHECK IF URL IS YOUTUBE ───
function isYouTubeUrl(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}

// ─── GET AUDIO URL (YouTube or direct) ───
async function getAudioUrl(url) {
    if (isYouTubeUrl(url)) {
        const result = await youtubedl(url, {
            dumpSingleJson: true,
            noPlaylist: true,
            format: 'bestaudio[ext=webm]/bestaudio/best',
            noWarnings: true
        });
        return {
            url: result.url,
            title: result.title || "YouTube Audio",
            isYouTube: true
        };
    } else {
        return {
            url: url,
            title: "Direct Stream",
            isYouTube: false
        };
    }
}

// ─── CREATE AUDIO RESOURCE ───
function createAudioResourceFromUrl(audioUrl, bassboosted, blast = false, pungi = false) {
    let finalStream = audioUrl;

    // Build audio filter chain
    let audioFilters = [];

    if (bassboosted) {
        audioFilters.push("equalizer=f=60:width_type=h:width=50:g=15");
    }

    if (pungi) {
        // PUNGI MODE: Snake charmer hypnotic destruction
        audioFilters.push("acrusher=bits=4:mode=log:aa=1"); // Bit crusher distortion
        audioFilters.push("equalizer=f=30:width_type=h:width=80:g=20"); // Sub-bass boost
        audioFilters.push("equalizer=f=100:width_type=h:width=100:g=15"); // Bass boost
        audioFilters.push("equalizer=f=1000:width_type=h:width=500:g=10"); // Mid boost
        audioFilters.push("equalizer=f=5000:width_type=h:width=2000:g=12"); // Treble boost
        audioFilters.push("loudnorm=I=-1:TP=0:LRA=1"); // Extreme compression
        audioFilters.push(`volume=${pungiIntensity}`); // Massive gain
        audioFilters.push("dynaudnorm=p=0.5:m=100.0:g=25"); // Aggressive normalization
        audioFilters.push("aphaser=0.8:0.8:2000:0.4"); // Phaser effect
        audioFilters.push("aecho=0.8:0.9:1000:0.3"); // Echo for hypnotic effect
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

    const resource = createAudioResource(finalStream, {
        inputType: (bassboosted || blast || pungi) ? StreamType.Raw : StreamType.Arbitrary,
        inlineVolume: true
    });

    // Set volume
    let vol;
    if (pungi) {
        vol = Math.min(pungiIntensity, 100.0);
    } else if (blast) {
        vol = Math.min(blastVolume, 100.0);
    } else {
        vol = currentVolumeMultiplier;
    }
    
    resource.volume.setVolume(vol);
    return resource;
}

// ─── PLAY AUDIO (with loop support) ───
async function playAudio(url, title, isYouTube) {
    if (!currentConnection) return;
    
    currentUrl = url;
    currentTitle = title;
    
    activeResource = createAudioResourceFromUrl(url, isBassboosted, blastMode, pungiMode);
    audioPlayer.play(activeResource);
    currentConnection.subscribe(audioPlayer);

    console.log(`[PLAYER] ▶️  Now playing: ${title}`);
    
    if (pungiMode) {
        console.log(`[PUNGI MODE] 🐍🎵 PUNGI SNAKE CHARMER ACTIVATED! 🎵🐍`);
        console.log(`[PUNGI MODE] Intensity: ${pungiIntensity}x (${Math.round(pungiIntensity * 100)}%)`);
        console.log(`[PUNGI MODE] Everyone will be hypnotized!`);
    } else if (blastMode) {
        console.log(`[BLAST MODE] 🔥 Intensity: ${Math.round(blastVolume * 100)}%`);
    }

    if (loudMode && currentConnection) {
        startLoudMode(currentConnection);
    }
}

// ─── START LOUD MODE ───
function startLoudMode(connection) {
    if (loudModeInterval) clearInterval(loudModeInterval);
    
    console.log("[LOUD MODE] 🔊 Monitoring voice activity...");
    
    loudModeInterval = setInterval(() => {
        if (!connection || !activeResource || !loudMode) return;
        
        const channel = client.channels.cache.get(currentChannelId);
        if (!channel || channel.type !== ChannelType.GuildVoice) return;
        
        const speakingMembers = channel.members.filter(m => {
            return m.id !== client.user.id && 
                   !m.voice.selfMute && 
                   m.voice.speaking;
        });
        
        if (speakingMembers.size > 0) {
            const newVolume = Math.min(
                currentVolumeMultiplier * loudModeBoost, 
                loudModeMaxVolume
            );
            
            if (activeResource.volume && activeResource.volume.volume !== newVolume) {
                activeResource.volume.setVolume(newVolume);
                console.log(`[LOUD MODE] 🔥 BOOSTING! Bot volume: ${Math.round(newVolume * 100)}%`);
            }
        } else {
            if (activeResource.volume && activeResource.volume.volume !== currentVolumeMultiplier) {
                activeResource.volume.setVolume(currentVolumeMultiplier);
                console.log(`[LOUD MODE] 📉 Normal volume: ${Math.round(currentVolumeMultiplier * 100)}%`);
            }
        }
    }, 500);
}

// ─── STOP LOUD MODE ───
function stopLoudMode() {
    if (loudModeInterval) {
        clearInterval(loudModeInterval);
        loudModeInterval = null;
    }
    loudMode = false;
    console.log("[LOUD MODE] ⛔ Disabled");
}

// ─── AUDIO PLAYER EVENTS ───
audioPlayer.on(AudioPlayerStatus.Playing, () => {
    console.log("[PLAYER] ▶️  Playing...");
    if (loudMode && currentConnection) {
        startLoudMode(currentConnection);
    }
});

audioPlayer.on(AudioPlayerStatus.Paused, () => {
    console.log("[PLAYER] ⏸️  Paused");
});

audioPlayer.on(AudioPlayerStatus.Idle, () => {
    console.log("[PLAYER] ⏹️  Stopped");
    
    // LOOP FEATURE: If loop is on, replay the song
    if (loopMode && currentUrl && currentConnection) {
        console.log("[LOOP] 🔄 Replaying: " + currentTitle);
        setTimeout(() => {
            playAudio(currentUrl, currentTitle, isYouTubeUrl(currentUrl));
        }, 500);
        return;
    }
    
    if (loudModeInterval) {
        clearInterval(loudModeInterval);
        loudModeInterval = null;
    }
});

audioPlayer.on("error", (error) => {
    console.error(`[PLAYER ERROR] ${error.message}`);
});

// ─── CONNECTION EVENTS ───
function attachConnectionEvents(connection) {
    connection.on(VoiceConnectionStatus.Ready, () => {
        console.log("[CONNECTION] ✅ Connected");
    });
    connection.on(VoiceConnectionStatus.Disconnected, () => {
        console.log("[CONNECTION] ⚠️ Disconnected (attempting to reconnect...)");
    });
    connection.on(VoiceConnectionStatus.Destroyed, () => {
        console.log("[CONNECTION] 💀 Destroyed");
        currentConnection = null;
        currentChannelId = null;
        stopLoudMode();
    });
}

// ─── READY ───
client.on("ready", async () => {
    console.log(`[BOT] Logged in as: ${client.user.tag}`);
    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log("║  🎵 MUSIC BOT v1.0 🎵                              ║");
    console.log("╠════════════════════════════════════════════════════╣");
    console.log("║  !join <channel-id>  → Join voice channel          ║");
    console.log("║  !play <url>         → Play audio                  ║");
    console.log("║  !pause / !resume    → Control playback            ║");
    console.log("║  !stop               → Stop                        ║");
    console.log("║  !loop               → Toggle loop mode 🔄          ║");
    console.log("║  !bassboost          → Toggle bass boost           ║");
    console.log("║  !volume <1-10000>   → Set volume                  ║");
    console.log("║  !blast              → Toggle Blast Mode 🔥         ║");
    console.log("║  !blastset <1-100>   → Set blast intensity         ║");
    console.log("║  !pungi              → 🐍 TOGGLE PUNGI MODE 🐍      ║");
    console.log("║  !pungiset <1-200>   → Set pungi intensity         ║");
    console.log("║  !loudmode           → Auto-boost when others speak║");
    console.log("║  !loudset <1-10>     → Loud mode multiplier       ║");
    console.log("║  !leave              → Disconnect                  ║");
    console.log("╚════════════════════════════════════════════════════╝\n");
});

// ─── MESSAGE HANDLER ───
client.on("messageCreate", async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Check if message starts with prefix
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        // ─── LOOP TOGGLE ───
        if (command === "loop") {
            loopMode = !loopMode;
            return message.reply(`[LOOP] 🔄 ${loopMode ? "ENABLED — Song will repeat forever!" : "Disabled"}`);
        }

        // ─── PUNGI MODE TOGGLE ───
        if (command === "pungi") {
            pungiMode = !pungiMode;
            blastMode = false;
            message.reply(`[PUNGI MODE] ${pungiMode ? "🐍🎵 PUNGI SNAKE CHARMER ACTIVATED! 🎵🐍" : "⛔ Pungi mode off"}`);
            
            if (pungiMode && activeResource && currentUrl && currentConnection) {
                console.log("[PUNGI MODE] Restarting with new settings...");
                playAudio(currentUrl, currentTitle, isYouTubeUrl(currentUrl));
            }
            return;
        }

        // ─── PUNGI INTENSITY SET ───
        if (command === "pungiset") {
            const val = parseFloat(args[0]);
            if (isNaN(val) || val < 1 || val > 200) {
                return message.reply("[ERROR] Pungi intensity must be 1-200 (200 = 20000%!)");
            }
            pungiIntensity = val;
            return message.reply(`[PUNGI MODE] Intensity: ${val}x (${Math.round(val * 100)}%)`);
        }

        // ─── BLAST MODE ───
        if (command === "blast") {
            blastMode = !blastMode;
            pungiMode = false;
            message.reply(`[BLAST MODE] ${blastMode ? "🔥 EXTREME BLAST ENABLED!" : "⛔ Blast disabled"}`);
            
            if (blastMode && activeResource && currentUrl && currentConnection) {
                playAudio(currentUrl, currentTitle, isYouTubeUrl(currentUrl));
            }
            return;
        }

        // ─── BLAST VOLUME SET ───
        if (command === "blastset") {
            const val = parseFloat(args[0]);
            if (isNaN(val) || val < 1 || val > 100) {
                return message.reply("[ERROR] Blast intensity must be 1-100");
            }
            blastVolume = val;
            return message.reply(`[BLAST MODE] Intensity: ${val}x (${Math.round(val * 100)}%)`);
        }

        // ─── LOUD MODE ───
        if (command === "loudmode") {
            loudMode = !loudMode;
            message.reply(`[LOUD MODE] ${loudMode ? "🔥 ENABLED" : "⛔ Disabled"}`);
            if (loudMode && currentConnection && audioPlayer.state.status === AudioPlayerStatus.Playing) {
                startLoudMode(currentConnection);
            } else if (!loudMode) {
                stopLoudMode();
            }
            return;
        }

        // ─── LOUD SET ───
        if (command === "loudset") {
            const boostVal = parseFloat(args[0]);
            if (isNaN(boostVal) || boostVal < 1 || boostVal > 10) {
                return message.reply("[ERROR] Boost must be 1-10");
            }
            loudModeBoost = boostVal;
            return message.reply(`[LOUD MODE] Boost: ${boostVal}x`);
        }

        if (command === "leave") {
            if (currentConnection) {
                stopLoudMode();
                audioPlayer.stop();
                currentConnection.destroy();
                activeResource = null;
                currentUrl = null;
                currentTitle = "Unknown";
                return message.reply("[CONNECTION] 👋 Left");
            } else {
                return message.reply("[ERROR] Not in a channel");
            }
        }

        if (command === "stop") {
            audioPlayer.stop();
            activeResource = null;
            return message.reply("[PLAYER] ⏹️ Stopped");
        }

        if (command === "pause") {
            if (audioPlayer.state.status === AudioPlayerStatus.Playing) {
                audioPlayer.pause();
                return message.reply("[PLAYER] ⏸️  Paused");
            } else {
                return message.reply("[ERROR] Not playing");
            }
        }

        if (command === "resume") {
            if (audioPlayer.state.status === AudioPlayerStatus.Paused) {
                audioPlayer.unpause();
                return message.reply("[PLAYER] ▶️  Resumed");
            } else {
                return message.reply("[ERROR] Not paused");
            }
        }

        // ─── VOLUME ───
        if (command === "volume") {
            const vol = parseInt(args[0], 10);
            if (isNaN(vol) || vol < 1 || vol > 10000) {
                return message.reply("[ERROR] Volume must be 1-10000");
            }
            currentVolumeMultiplier = vol / 100;
            return message.reply(`[VOLUME] Set to ${vol}% ${vol > 1000 ? "🔥🔥🔥" : vol > 500 ? "🔥🔥" : vol > 100 ? "🔥" : ""}`);
        }

        if (command === "bassboost") {
            if (!currentConnection || !currentUrl) {
                return message.reply("[ERROR] Play something first");
            }
            isBassboosted = !isBassboosted;
            return message.reply(`[BASSBOOST] ${isBassboosted ? "ON" : "OFF"} — Restart to apply`);
        }

        // ─── PLAY ───
        if (command === "play") {
            const audioUrl = args.join(" ");
            
            if (!audioUrl.startsWith('http')) {
                return message.reply("[ERROR] Please provide a valid URL");
            }

            if (!currentConnection) {
                return message.reply("[ERROR] Join a voice channel first");
            }

            const type = isYouTubeUrl(audioUrl) ? "YouTube" : "Direct Audio";
            await message.reply(`[PLAYER] ⏳ Fetching ${type} stream...`);

            try {
                const { url, title, isYouTube } = await getAudioUrl(audioUrl);
                await playAudio(url, title, isYouTube);
            } catch (err) {
                console.error(`[ERROR] ${err.message}`);
                return message.reply(`[ERROR] ${err.message}`);
            }
            return;
        }

        // ─── JOIN VOICE CHANNEL ───
        if (command === "join") {
            const channelId = args[0];
            
            if (!channelId || channelId.length < 10) {
                return message.reply("[ERROR] Please provide a valid channel ID");
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

                message.reply(`[CONNECTION] ✅ Joined: ${channel.name}`);

            } catch (err) {
                console.error(`[JOIN ERROR] ${err.message}`);
                message.reply(`[ERROR] ${err.message}`);
            }
            return;
        }

    } catch (err) {
        console.error(err);
        message.reply(`[ERROR] ${err.message}`).catch(console.error);
    }
});

client.login(BOT_TOKEN);
