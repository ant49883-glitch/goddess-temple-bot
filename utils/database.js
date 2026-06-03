/**
 * Database — auto-detects environment:
 *   Railway (DATABASE_URL set) → PostgreSQL via pg
 *   Local / no DATABASE_URL    → SQLite via better-sqlite3
 *
 * The exported API is identical in both cases so nothing else needs to change.
 */

const USE_PG = !!process.env.DATABASE_URL;

let db; // pg Pool  OR  better-sqlite3 instance

// ─── PostgreSQL (Railway) ──────────────────────────────────────────────────
if (USE_PG) {
  const { Pool } = require("pg");
  db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  console.log("🐘 Using PostgreSQL (Railway)");
} else {
  // ─── SQLite (local dev) ────────────────────────────────────────────────
  const Database = require("better-sqlite3");
  const path = require("path");
  const fs = require("fs");
  const dbPath = path.join(__dirname, "../data/tickets.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  console.log("🗄️  Using SQLite (local)");
}

// ─── Schema init ──────────────────────────────────────────────────────────
async function initSchema() {
  const pgSchema = `
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
  `;

  const sqliteSchema = `
    CREATE TABLE IF NOT EXISTS tickets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id  TEXT NOT NULL UNIQUE,
      guild_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      category    TEXT NOT NULL,
      priority    INTEGER NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'open',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at   TEXT,
      claimed_by  TEXT
    );
    CREATE TABLE IF NOT EXISTS priority_whitelist (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      added_by    TEXT NOT NULL,
      added_at    TEXT NOT NULL DEFAULT (datetime('now')),
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
  `;

  if (USE_PG) {
    await db.query(pgSchema);
  } else {
    db.exec(sqliteSchema);
  }
}

// ─── Query helpers ─────────────────────────────────────────────────────────
// Unified query: always returns rows array (pg) or array (sqlite).
async function query(sql, params = []) {
  if (USE_PG) {
    const res = await db.query(sql, params);
    return res.rows;
  } else {
    // Convert $1,$2 placeholders → ? for SQLite
    const sqliteSql = sql.replace(/\$\d+/g, "?");
    const stmt = db.prepare(sqliteSql);
    if (/^\s*(SELECT|WITH)/i.test(sql)) {
      return stmt.all(...params);
    } else {
      const info = stmt.run(...params);
      return [{ id: info.lastInsertRowid, changes: info.changes }];
    }
  }
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

// ─── Ticket functions ──────────────────────────────────────────────────────
async function getNextTicketNumber(guildId) {
  if (USE_PG) {
    const res = await db.query(
      `INSERT INTO ticket_counter (guild_id, count) VALUES ($1, 1)
       ON CONFLICT (guild_id) DO UPDATE SET count = ticket_counter.count + 1
       RETURNING count`,
      [guildId]
    );
    return res.rows[0].count;
  } else {
    const row = db.prepare("SELECT count FROM ticket_counter WHERE guild_id = ?").get(guildId);
    if (!row) {
      db.prepare("INSERT INTO ticket_counter (guild_id, count) VALUES (?, 1)").run(guildId);
      return 1;
    }
    const next = row.count + 1;
    db.prepare("UPDATE ticket_counter SET count = ? WHERE guild_id = ?").run(next, guildId);
    return next;
  }
}

async function createTicket({ channelId, guildId, userId, category, priority }) {
  const ticketNum = await getNextTicketNumber(guildId);
  await query(
    `INSERT INTO tickets (channel_id, guild_id, user_id, category, priority)
     VALUES ($1, $2, $3, $4, $5)`,
    [channelId, guildId, userId, category, priority ? true : false]
  );
  return ticketNum;
}

async function getTicket(channelId) {
  return queryOne("SELECT * FROM tickets WHERE channel_id = $1", [channelId]);
}

async function getOpenTicketsByUser(guildId, userId) {
  return query(
    "SELECT * FROM tickets WHERE guild_id = $1 AND user_id = $2 AND status = 'open'",
    [guildId, userId]
  );
}

async function closeTicket(channelId, closedBy) {
  await query(
    `UPDATE tickets SET status = 'closed', closed_at = NOW(), claimed_by = $1
     WHERE channel_id = $2`,
    [closedBy, channelId]
  );
}

async function claimTicket(channelId, userId) {
  await query("UPDATE tickets SET claimed_by = $1 WHERE channel_id = $2", [userId, channelId]);
}

// ─── Whitelist functions ───────────────────────────────────────────────────
async function addToWhitelist(guildId, userId, addedBy) {
  try {
    await query(
      `INSERT INTO priority_whitelist (guild_id, user_id, added_by) VALUES ($1, $2, $3)`,
      [guildId, userId, addedBy]
    );
    return true;
  } catch {
    return false;
  }
}

async function removeFromWhitelist(guildId, userId) {
  const rows = await query(
    "DELETE FROM priority_whitelist WHERE guild_id = $1 AND user_id = $2 RETURNING id",
    [guildId, userId]
  );
  return rows.length > 0;
}

async function isWhitelisted(guildId, userId) {
  const row = await queryOne(
    "SELECT 1 FROM priority_whitelist WHERE guild_id = $1 AND user_id = $2",
    [guildId, userId]
  );
  return !!row;
}

async function getWhitelist(guildId) {
  return query("SELECT * FROM priority_whitelist WHERE guild_id = $1", [guildId]);
}

// ─── Panel config ──────────────────────────────────────────────────────────
async function savePanelConfig(guildId, data) {
  await query(
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
  return queryOne("SELECT * FROM panel_config WHERE guild_id = $1", [guildId]);
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
