# Multiple Bots Setup Guide

## How to Run Multiple Bot Instances

### 1. Get Bot Tokens Legitimately

For EACH bot you want to run:
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Go to "Bot" section → "Add Bot"
4. Copy the token
5. Enable required intents:
   - Message Content Intent (for commands)
   - Server Members Intent (optional)
6. Set permissions: Send Messages, Connect (voice), Speak (voice)
7. Generate OAuth2 URL and invite to your server

### 2. Configure Railway Variables

Do not put tokens in `bot-manager.js` or any committed file. In Railway, add `BOT_TOKENS` as a comma-separated list of bot tokens:

```text
token_for_bot_1,token_for_bot_2,token_for_bot_3
```

For one bot, add `BOT_TOKEN` instead.

### 3. Run the Bot Manager

```bash
cd ganil
node bot-manager.js
```

This will:
- Start multiple bot instances automatically
- Each bot runs independently
- All bots share the same codebase
- Each bot has a unique ID and token

### 4. Use the Bots in Discord

In any Discord channel, use commands with any bot:

```
!join <channel-id>    - Join voice channel
!play <url>           - Play audio
!blast                - Enable blast mode
!volume 10000         - Set volume
!stop                 - Stop playing
!leave                - Leave channel
```

## Files Created

- **bot-manager.js** - Manages multiple bot processes
- **bot-instance.js** - Individual bot instance (called by manager)

## Example Usage

With 3 bots and 3 tokens:

```
BOT_TOKENS = [token1, token2, token3]
```

Run:
```
node bot-manager.js
```

Output:
```
[BOT MANAGER] Starting 3 bot instances...
[BOT MANAGER] Launching Bot 1...
[BOT 1] ✅ Logged in as: MusicBot#1234
[BOT MANAGER] Launching Bot 2...
[BOT 2] ✅ Logged in as: MusicBot#5678
[BOT MANAGER] Launching Bot 3...
[BOT 3] ✅ Logged in as: MusicBot#9012
```

## Important Notes

✅ **LEGIT USAGE:**
- Each bot needs its own Discord token
- Only for legitimate bot applications
- Follows Discord Terms of Service
- Each bot can be in different servers
- Useful for load balancing or specialized features

❌ **AVOID:**
- Token sharing/selling
- Spam or harassment
- Violating Discord ToS
- Unauthorized access

## PM2 Alternative (For Production)

For persistent running:

```bash
npm install pm2 -g
pm2 start bot-manager.js --name "multi-bot"
pm2 logs multi-bot
pm2 stop multi-bot
```

## Stop All Bots

Press `Ctrl+C` in the terminal to gracefully shutdown all bots.
