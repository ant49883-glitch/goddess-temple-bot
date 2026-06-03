require("dotenv").config();
const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
const fs = require("fs");
const path = require("path");

// ── Validate env ──────────────────────────────────────────────
if (!process.env.BOT_TOKEN) {
  console.error("❌ BOT_TOKEN is missing from your .env file!");
  process.exit(1);
}

// ── Create client ─────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ── Load commands ─────────────────────────────────────────────
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");

for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"))) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: /${command.data.name}`);
  }
}

// ── Load events ───────────────────────────────────────────────
const eventsPath = path.join(__dirname, "events");

for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith(".js"))) {
  const event = require(path.join(eventsPath, file));
  const handler = (...args) => event.execute(...args, client);
  if (event.once) {
    client.once(event.name, handler);
  } else {
    client.on(event.name, handler);
  }
  console.log(`✅ Loaded event: ${event.name}`);
}

// ── Global error handling ─────────────────────────────────────
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

// ── Init DB schema then login ─────────────────────────────────
const { initSchema } = require("./utils/database");
initSchema()
  .then(() => client.login(process.env.BOT_TOKEN))
  .catch((err) => {
    console.error("❌ Failed to init database schema:", err);
    process.exit(1);
  });
