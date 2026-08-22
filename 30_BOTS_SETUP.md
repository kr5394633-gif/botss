# 30 BOTS SETUP - Quick Guide

## Step 1: Get 30 Bot Tokens from Discord

### Bulk Token Generation Script

Create a file called `get_tokens.md` to track your 30 bots:

**Manual Process (for each bot):**

1. Go to https://discord.com/developers/applications
2. Click "New Application" 
3. Name it: `Music Bot 1`, `Music Bot 2`, etc.
4. Go to "Bot" section → "Add Bot"
5. Click "Copy" next to TOKEN
6. Save the token in a secure location

### Repeat for 30 bots!

---

## Step 2: Configure Tokens

Do not commit tokens to the repository. Set a Railway Variable named `BOT_TOKENS` to a comma-separated list of tokens:

```text
token_for_bot_1,token_for_bot_2,token_for_bot_3
```

For one bot, use `BOT_TOKEN` instead. Railway automatically provides variables to the start command `node ganil/start.js`.

---

## Step 3: Invite All 30 Bots to Your Server

For EACH bot:

1. Go to Discord Developer Portal
2. Select the bot application
3. Go to OAuth2 → URL Generator
4. Select scopes: `bot`
5. Select permissions:
   - ✅ Send Messages
   - ✅ Connect (voice)
   - ✅ Speak (voice)
6. Copy the generated URL
7. Open in browser and invite to your server

**Repeat for all 30 bots!**

---

## Step 4: Run the Multi-Bot Manager

```bash
cd ganil
node bot-manager.js
```

**Expected Output:**
```
[BOT MANAGER] Starting 30 bot instances...
[BOT MANAGER] Launching Bot 1...
[BOT 1] ✅ Logged in as: MusicBot1#XXXX
[BOT MANAGER] Launching Bot 2...
[BOT 2] ✅ Logged in as: MusicBot2#XXXX
...
[BOT 30] ✅ Logged in as: MusicBot30#XXXX
[BOT MANAGER] All bots launched. Press Ctrl+C to stop all.
```

---

## Step 5: Use the 30 Bots in Discord

In any Discord channel, send commands to ANY bot:

```
!join 1540294242084331631    → Any bot joins channel
!play <url>                   → Any bot plays music
!blast                        → Blast mode on
!volume 10000                 → Max volume
!leave                        → Bot leaves
```

---

## Shortcuts & Tips

### Quick Token Copying
1. Open Discord Developer Portal in multiple tabs (one per bot)
2. Copy tokens to `tokens.txt`
3. Paste into `bot-manager.js`

### Testing With Fewer Bots
```javascript
const BOT_TOKENS = [
    "TOKEN_1",
    "TOKEN_2",
    "TOKEN_3",
    // Comment out rest for testing
];
```

### Stop All Bots
Press `Ctrl+C` in terminal

### Logs
To see detailed logs:
```bash
node bot-manager.js 2>&1 | tee bot.log
```

---

## Troubleshooting

**Bot not connecting:**
- ✅ Make sure token is valid
- ✅ Bot is invited to server
- ✅ Bot has permissions
- ✅ Check if bot is online in Discord

**"Invalid token" error:**
- Copy token correctly from Developer Portal
- No extra spaces or characters

**Multiple bot instances not starting:**
- Check `bot-instance.js` is in same folder
- Make sure all dependencies installed: `npm install`

---

## Architecture

```
bot-manager.js (Main process)
    ├── bot-instance.js (Bot 1 process)
    ├── bot-instance.js (Bot 2 process)
    ├── bot-instance.js (Bot 3 process)
    ...
    └── bot-instance.js (Bot 30 process)
```

Each bot runs independently but is managed by the main manager.

---

## Discord Developer Portal Links

- Applications: https://discord.com/developers/applications
- Documentation: https://discord.com/developers/docs
- Support: https://discord.gg/discord-developers

Good luck with 30 bots! 🚀🎵
