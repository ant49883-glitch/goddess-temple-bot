/**
 * Database — PostgreSQL only (Railway)
 */

const { Pool } = require("pg");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

console.log("🐘 Using PostgreSQL (Railway)");

async function initSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id          SERIAL PRIMARY KEY,
      channel_id  TEXT NOT NULL UNIQUE,
      guild_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      category    TEXT NOT NULL,
      priority    BOOLEAN NOT NULL DEFAULT FALSE,
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at   TIMESTAMPTZ,
      claimed_by  TEXT
    );
    CREATE TABLE IF NOT EXISTS priority_whitelist (
      id          SERIAL PRIMARY KEY,
      guild_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      added_by    TEXT NOT NULL,
      added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(guild_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS ticket_counter (
      guild_id    TEXT PRIMARY KEY,
      count       INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS panel_config (
      guild_id       TEXT PRIMARY KEY,
      channel_id     TEXT,
      message_id     TEXT,
      custom_title   TEXT,
      custom_desc    TEXT,
      custom_color   TEXT,
      custom_footer  TEXT
    );
  `);
}

async function getNextTicketNumber(guildId) {
  const res = await db.query(
    `INSERT INTO ticket_counter (guild_id, count) VALUES ($1, 1)
     ON CONFLICT (guild_id) DO UPDATE SET count = ticket_counter.count + 1
     RETURNING count`,
    [guildId]
  );
  return res.rows[0].count;
}

async function createTicket({ channelId, guildId, userId, category, priority }) {
  const ticketNum = await getNextTicketNumber(guildId);
  await db.query(
    `INSERT INTO tickets (channel_id, guild_id, user_id, category, priority)
     VALUES ($1, $2, $3, $4, $5)`,
    [channelId, guildId, userId, category, priority]
  );
  return ticketNum;
}

async function getTicket(channelId) {
  const res = await db.query("SELECT * FROM tickets WHERE channel_id = $1", [channelId]);
  return res.rows[0] ?? null;
}

async function getOpenTicketsByUser(guildId, userId) {
  const res = await db.query(
    "SELECT * FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status = 'open'",
    [guildId, userId]
  );
  return res.rows;
}

async function closeTicket(channelId, closedBy) {
  await db.query(
    `UPDATE tickets SET status = 'closed', closed_at = NOW(), claimed_by = $1 WHERE channel_id = $2`,
    [closedBy, channelId]
  );
}

async function claimTicket(channelId, userId) {
  await db.query("UPDATE tickets SET claimed_by = $1 WHERE channel_id = $2", [userId, channelId]);
}

async function addToWhitelist(guildId, userId, addedBy) {
  try {
    await db.query(
      `INSERT INTO priority_whitelist (guild_id, user_id, added_by) VALUES ($1, $2, $3)`,
      [guildId, userId, addedBy]
    );
    return true;
  } catch { return false; }
}

async function removeFromWhitelist(guildId, userId) {
  const res = await db.query(
    "DELETE FROM priority_whitelist WHERE guild_id = $1 AND user_id = $2 RETURNING id",
    [guildId, userId]
  );
  return res.rows.length > 0;
}

async function isWhitelisted(guildId, userId) {
  const res = await db.query(
    "SELECT 1 FROM priority_whitelist WHERE guild_id = $1 AND user_id = $2",
    [guildId, userId]
  );
  return res.rows.length > 0;
}

async function getWhitelist(guildId) {
  const res = await db.query("SELECT * FROM priority_whitelist WHERE guild_id = $1", [guildId]);
  return res.rows;
}

async function savePanelConfig(guildId, data) {
  await db.query(
    `INSERT INTO panel_config (guild_id, channel_id, message_id, custom_title, custom_desc, custom_color, custom_footer)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(guild_id) DO UPDATE SET
       channel_id   = EXCLUDED.channel_id,
       message_id   = EXCLUDED.message_id,
       custom_title = EXCLUDED.custom_title,
       custom_desc  = EXCLUDED.custom_desc,
       custom_color = EXCLUDED.custom_color,
       custom_footer= EXCLUDED.custom_footer`,
    [guildId, data.channelId, data.messageId, data.customTitle ?? null,
     data.customDesc ?? null, data.customColor ?? null, data.customFooter ?? null]
  );
}

async function getPanelConfig(guildId) {
  const res = await db.query("SELECT * FROM panel_config WHERE guild_id = $1", [guildId]);
  return res.rows[0] ?? null;
}

module.exports = {
  initSchema,
  getNextTicketNumber,
  createTicket,
  getTicket,
  getOpenTicketsByUser,
  closeTicket,
  claimTicket,
  addToWhitelist,
  removeFromWhitelist,
  isWhitelisted,
  getWhitelist,
  savePanelConfig,
  getPanelConfig,
};
