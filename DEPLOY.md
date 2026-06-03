# 🚀 Deploying to GitHub + Railway

Follow these steps in order. Takes about 10 minutes.

---

## PART 1 — Push to GitHub

### Step 1: Create a GitHub repo

1. Go to **github.com** → click the **+** → **New repository**
2. Name it `goddess-temple-bot` (or anything you like)
3. Set it to **Private** ← important, your config is in here
4. **Do NOT** check "Add README" — leave it empty
5. Click **Create repository**

### Step 2: Push your bot files

Open a terminal in your `goddess-temple-bot` folder and run:

```bash
git init
git add .
git commit -m "Initial commit — Goddess Temple ticket bot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/goddess-temple-bot.git
git push -u origin main
```

> Replace `YOUR_USERNAME` with your GitHub username.

✅ Your bot is now on GitHub.

---

## PART 2 — Set Up Railway

### Step 3: Create a Railway account

1. Go to **railway.app** and sign up (use your GitHub account — easiest)

### Step 4: Create a new project

1. Click **New Project**
2. Choose **Deploy from GitHub repo**
3. Authorize Railway to access your GitHub
4. Select your `goddess-temple-bot` repo
5. Railway will detect it — **don't deploy yet**, click **Add Variables** first

### Step 5: Add environment variables

In your Railway project, go to your service → **Variables** tab → add these:

| Variable | Value |
|---|---|
| `BOT_TOKEN` | Your Discord bot token |
| `CLIENT_ID` | Your Discord application ID |
| `GUILD_ID` | Your Discord server ID |

> To get these: discord.com/developers → your app → Bot (token), General Information (application ID).
> Server ID: right-click your server in Discord → Copy Server ID (need Developer Mode on).

### Step 6: Add PostgreSQL (persistent database)

1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**
2. Once it provisions, click the Postgres service → **Variables** tab
3. Copy the `DATABASE_URL` value
4. Go back to your **bot service** → Variables → add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | (paste the URL you copied) |

> Railway also automatically injects `DATABASE_URL` if both services are in the same project — if yours already shows up in the bot's variables, you're done!

### Step 7: Deploy

1. Go to your bot service → **Deploy** tab → click **Deploy**
2. Watch the build logs — you should see:
   ```
   🐘 Using PostgreSQL (Railway)
   ✨ Goddess Temple Bot is online as YourBot#0000
   ```

✅ Your bot is live 24/7 on Railway!

---

## PART 3 — Register Slash Commands

Slash commands must be registered once. You can do this from your local machine:

```bash
# Make sure your .env file has BOT_TOKEN, CLIENT_ID, GUILD_ID
node deploy-commands.js
```

You should see:
```
🚀 Deploying 4 command(s) to guild ...
✅ All commands deployed successfully!
```

Commands will appear in Discord within a few seconds.

---

## PART 4 — First-Time Discord Setup

In your Discord server:

1. **Set up channels:**
   - Create a `#create-ticket` channel (or wherever you want the panel)
   - Create a `#ticket-logs` channel for transcripts
   - Create a `Tickets` category for ticket channels (optional)

2. **Fill in `config/config.js`:**
   ```js
   staffRoleIds: ["YOUR_STAFF_ROLE_ID"],
   boosterRoleId: "YOUR_BOOSTER_ROLE_ID",   // right-click booster role → copy ID
   logChannelId: "YOUR_TICKET_LOGS_CHANNEL_ID",
   archiveCategoryId: null,   // or set a category ID to archive closed tickets
   ```

3. **Commit and push the config changes:**
   ```bash
   git add config/config.js
   git commit -m "Add server role/channel IDs"
   git push
   ```
   Railway will auto-redeploy.

4. **Send the ticket panel:**
   Go to `#create-ticket` and run:
   ```
   /ticket-panel send #create-ticket
   ```

---

## Updating the Bot Later

Any time you change code:

```bash
git add .
git commit -m "your change description"
git push
```

Railway auto-deploys on every push to `main`. ✨

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Bot offline on Railway | Check Variables tab — all 3 env vars set? Check Logs tab for errors |
| Commands not showing | Run `node deploy-commands.js` from your local machine |
| Database errors | Check that `DATABASE_URL` is set in Railway Variables |
| Bot can't create channels | Make sure bot has Administrator permission in your server |
| "Missing permissions" on ticket create | Bot's role must be higher than the channels/category |
