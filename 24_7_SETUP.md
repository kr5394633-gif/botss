# 24/7 Bot Manager Setup (PM2)

## What is PM2?

PM2 is a process manager that:
- ✅ Keeps your bots running 24/7
- ✅ Auto-restarts if a bot crashes
- ✅ Starts on system reboot automatically
- ✅ Logs all bot activity
- ✅ Easy to manage and monitor

---

## Installation (Already Done)

```bash
npm install -g pm2
```

---

## Start 30 Bots with PM2

### Option 1: Simple Start

```bash
pm2 start ganil/bot-manager.js --name "30-bots"
```

### Option 2: With More Options (Recommended)

```bash
cd c:\Users\HP\Downloads\Discord-Selfbot-main-by-rintu
pm2 start ganil/bot-manager.js --name "30-bots" --max-memory-restart 1G
```

This will:
- Start all 30 bots
- Restart if memory exceeds 1GB
- Keep them running in background

---

## Enable Auto-Start on System Reboot

**IMPORTANT: Run Command Prompt as Administrator**

```bash
pm2 startup
```

Then copy and run the generated command (it will look like):
```
pm2 startup powershell -u HP --hp C:\Users\HP
```

After that:
```bash
pm2 save
```

Now your bots will **automatically start when system reboots!**

---

## Managing Your Bots

### View All Running Processes
```bash
pm2 list
```

### View Detailed Status
```bash
pm2 status
```

### View Logs (Real-time)
```bash
pm2 logs 30-bots
```

### View Logs of Specific Bot
```bash
pm2 logs 30-bots --lines 100
```

### Stop All Bots
```bash
pm2 stop 30-bots
```

### Restart All Bots
```bash
pm2 restart 30-bots
```

### Delete from PM2 (Stop monitoring)
```bash
pm2 delete 30-bots
```

### Stop PM2 Daemon
```bash
pm2 kill
```

### Monitor in Real-time
```bash
pm2 monit
```

---

## Example Commands

**Check if bots are online:**
```bash
pm2 list
```

Output:
```
id │ name    │ namespace │ version │ mode │ pid  │ status  │ restart │ uptime 
──┼─────────┼───────────┼─────────┼──────┼──────┼─────────┼─────────┼────────
0  │ 30-bots │ default   │ 0.0.0   │ fork │ 1234 │ online  │ 0       │ 2h
```

**Check which bots are connected:**
```bash
pm2 logs 30-bots
```

**Restart if something breaks:**
```bash
pm2 restart 30-bots
```

---

## Auto-Restart on Crash

PM2 automatically restarts failed bots. You can configure max restarts:

```bash
pm2 start ganil/bot-manager.js --name "30-bots" --max-restarts 5
```

---

## Setup for 24/7 Operation

### Railway deployment

Deploy the repository root so the `ganil` folder is included. Leave **Root Directory** empty and use the start command:

```bash
npm start
```

If Railway is configured with **Root Directory** set to `/ganil`, use this start command instead:

```bash
npm start
```

The `ganil/package.json` file is configured to start `start.js` in that layout. Add `BOT_TOKENS` (comma-separated) or `BOT_TOKEN` under Railway Variables, then redeploy.

### 1. Start with PM2
```bash
cd c:\Users\HP\Downloads\Discord-Selfbot-main-by-rintu
pm2 start ganil/bot-manager.js --name "30-bots" --max-memory-restart 1G
```

### 2. Enable Auto-Start
```bash
pm2 startup
# Copy and run the command it generates
pm2 save
```

### 3. Verify It Works
```bash
pm2 list
pm2 logs 30-bots
```

### 4. Test Reboot
Restart your computer - bots should auto-start!

---

## Troubleshooting

**Bots not starting on reboot?**
- Make sure you ran `pm2 startup` and `pm2 save`
- Run Command Prompt as Administrator
- Check: `pm2 list`

**Bots keep crashing?**
- Check logs: `pm2 logs 30-bots`
- Check if Discord tokens are valid
- Restart: `pm2 restart 30-bots`

**Want to see logs?**
```bash
pm2 logs 30-bots --lines 500
```

**How to stop everything?**
```bash
pm2 stop 30-bots    # Stops but keeps monitoring
pm2 delete 30-bots  # Stops and removes from PM2
pm2 kill            # Kills PM2 daemon entirely
```

---

## PM2 Web Dashboard (Optional)

```bash
pm2 web
```

Visit: `http://localhost:9615`

You can view all bots in a web interface!

---

## Summary

✅ **Your 30 Bots Are Now:**
- Running 24/7 even after you close terminal
- Auto-restarting if they crash
- Auto-starting on system reboot
- Monitored and logged by PM2

You can now close the terminal window and your bots will keep running!

**To check status anytime:**
```bash
pm2 list
pm2 logs 30-bots
```

Happy botting! 🤖🎵
