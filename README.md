# ✨ Goddess Temple — Ticket Bot

A fully-featured ticket bot built exclusively for the **Goddess Temple** Discord server, with priority tickets for boosters and whitelisted members.

---

## 📋 Features

- **Ticket Panel** — Beautiful embed with category buttons (General, Report, Application, Partnership, Other — fully customizable)
- **Priority Tickets** — Auto-detected for Server Boosters + admin-whitelisted users; marked with ⭐, separate naming, pinged staff, higher open ticket limit
- **Ticket Management** — Open, close, claim, add/remove users, rename, transcript
- **Transcripts** — Saved to a log channel on close as a `.txt` file
- **Customizable** — Colors, messages, categories, channel names, and per-category welcome messages all in `config/config.js`
- **Persistent** — Uses SQLite so data survives restarts

---

## 🚀 Setup

### 1. Create a Discord Bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → name it (e.g. "Goddess Temple Tickets")
3. Go to **Bot** → click **Add Bot**
4. Under **Privileged Gateway Intents**, enable:
   - Server Members Intent
   - Message Content Intent
5. Click **Reset Token** and copy your token
6. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Administrator` (or at minimum: Manage Channels, Manage Roles, Send Messages, Embed Links, Attach Files, Read Message History, View Channels)
7. Open the generated URL and invite the bot to your server

### 2. Install Dependencies

```bash
cd goddess-temple-bot
npm install
```

### 3. Create Your .env File

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
BOT_TOKEN=your_actual_bot_token
GUILD_ID=your_server_id
CLIENT_ID=your_application_id
```

**How to get IDs:** Enable Developer Mode in Discord (Settings → Advanced → Developer Mode), then right-click your server → **Copy Server ID** for GUILD_ID.

### 4. Configure the Bot

Open `config/config.js` and edit:

| Setting | Description |
|---|---|
| `staffRoleIds` | Role IDs that can manage all tickets |
| `boosterRoleId` | Your server's Booster role ID |
| `logChannelId` | Channel ID for ticket transcripts |
| `archiveCategoryId` | Category to move closed tickets (or `null` to delete) |
| `ticketCategories` | Add/remove/edit ticket types |
| `colors` | Hex colors for all embeds |
| `panel` | Ticket panel title, description, footer |

### 5. Deploy Commands

```bash
npm run deploy
```

### 6. Start the Bot

```bash
npm start
```

---

## 📖 Commands

### Admin Commands

| Command | Description |
|---|---|
| `/ticket-panel send #channel` | Send the ticket panel to a channel |
| `/ticket-panel customize` | Customize the panel title/description/color/footer |
| `/ticket-panel refresh` | Re-send the panel (after edits) |
| `/ticket-customize welcome` | Set custom welcome message per category |
| `/ticket-customize view` | View current custom messages |
| `/ticket-customize reset` | Reset a category to default message |
| `/priority add @user` | Whitelist a user for priority tickets |
| `/priority remove @user` | Remove from whitelist |
| `/priority list` | View all whitelisted users |

### Staff Commands (inside ticket channels)

| Command | Description |
|---|---|
| `/ticket close [reason]` | Close the ticket (saves transcript) |
| `/ticket add @user` | Add a user to the ticket |
| `/ticket remove @user` | Remove a user from the ticket |
| `/ticket rename name` | Rename the ticket channel |
| `/ticket claim` | Claim the ticket |
| `/ticket unclaim` | Unclaim the ticket |
| `/ticket info` | View ticket details |
| `/ticket transcript` | Manually save transcript to log channel |

### Ticket Buttons

Each ticket channel has 3 buttons: **Claim**, **Close Ticket**, **Save Transcript**
The ticket panel itself has one button per category.

---

## ⭐ Priority Tickets

A user gets a **Priority Ticket** if they are:
1. A **Server Booster** (has `premiumSince` set, or has the role in `boosterRoleId`)
2. **Whitelisted** by an admin via `/priority add @user`

Priority ticket benefits:
- Channel name prefixed with `⭐`
- Gold embed color instead of purple
- Staff roles pinged on creation
- Higher max open tickets (`maxTicketsPerUserPriority` in config)
- Channel topic marked as `⭐ PRIORITY`

---

## 📁 File Structure

```
goddess-temple-bot/
├── index.js              # Bot entry point
├── deploy-commands.js    # Run once to register slash commands
├── .env.example          # Environment variable template
├── package.json
├── config/
│   └── config.js         # ← ALL customization goes here
├── commands/
│   ├── ticket.js         # /ticket (close, add, remove, etc.)
│   ├── ticketPanel.js    # /ticket-panel (send, customize, refresh)
│   ├── ticketCustomize.js# /ticket-customize (per-category messages)
│   └── priority.js       # /priority (whitelist management)
├── events/
│   ├── ready.js          # Bot startup
│   └── interactionCreate.js # Button + slash command handler
├── utils/
│   ├── database.js       # SQLite wrapper
│   └── ticketHelpers.js  # Embed builders, permission checks
└── data/
    └── tickets.db        # Auto-created SQLite database
```

---

## 🎨 Customizing Categories

In `config/config.js`, edit `ticketCategories`:

```js
{
  id: "vip",             // Unique ID (no spaces)
  emoji: "👑",           // Emoji shown on button
  label: "VIP Support",  // Button label
  description: "...",    // Shown in ticket embed
  style: "Primary",      // Primary | Secondary | Success | Danger
}
```

After editing, run `npm run deploy` again and `/ticket-panel refresh` in Discord.
