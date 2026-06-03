// ============================================================
//  GODDESS TEMPLE — TICKET BOT CONFIGURATION
//  Edit this file to customize the bot for your server.
// ============================================================

module.exports = {
  // ── SERVER BRANDING ─────────────────────────────────────
  serverName: "Goddess Temple",
  serverIcon: null, // URL to your server icon (used in embeds), or null

  // ── COLORS ──────────────────────────────────────────────
  colors: {
    primary: "#c084fc",     // Main embed color (soft purple)
    priority: "#f59e0b",    // Priority ticket color (gold)
    success: "#34d399",     // Green for success messages
    error: "#f87171",       // Red for error messages
    info: "#60a5fa",        // Blue for info messages
    closed: "#6b7280",      // Gray for closed tickets
  },

  // ── TICKET CATEGORIES ────────────────────────────────────
  // Each category creates a button on the ticket panel.
  // emoji: Discord emoji string (e.g. "🎫" or a custom emoji "<:name:id>")
  // label: Button label text
  // description: Shown in the ticket's opening embed
  // style: "Primary" | "Secondary" | "Success" | "Danger"
  ticketCategories: [
    {
      id: "general",
      emoji: "🎫",
      label: "General Support",
      description: "Open a ticket for general questions or help.",
      style: "Primary",
    },
    {
      id: "report",
      emoji: "⚠️",
      label: "Report a User",
      description: "Report a member who has broken the rules.",
      style: "Danger",
    },
    {
      id: "application",
      emoji: "📋",
      label: "Staff Application",
      description: "Apply for a staff position in Goddess Temple.",
      style: "Success",
    },
    {
      id: "partnership",
      emoji: "🤝",
      label: "Partnership",
      description: "Inquire about partnering with Goddess Temple.",
      style: "Secondary",
    },
    {
      id: "other",
      emoji: "💬",
      label: "Other",
      description: "Anything else not covered by the above categories.",
      style: "Secondary",
    },
  ],

  // ── CHANNEL NAMES ────────────────────────────────────────
  // How ticket channels are named. Available variables:
  //   {username}  — Discord username of the opener
  //   {id}        — Ticket number (e.g. 0042)
  //   {category}  — Category id (e.g. "general")
  ticketChannelName: "ticket-{id}-{username}",
  priorityTicketChannelName: "⭐-ticket-{id}-{username}",

  // ── TICKET PANEL EMBED ───────────────────────────────────
  panel: {
    title: "✨ Goddess Temple — Support",
    description:
      "Welcome to Goddess Temple support!\n\n" +
      "Please select a category below to open a ticket.\n" +
      "Our staff will assist you as soon as possible.\n\n" +
      "**Priority tickets** are available for **Server Boosters** and **whitelisted members** — your ticket will be pinned at the top and marked for faster response.",
    footer: "Goddess Temple • Support System",
    thumbnailUrl: null, // URL for a small thumbnail image, or null
  },

  // ── TICKET OPENING MESSAGE ───────────────────────────────
  // Shown inside each new ticket channel.
  // {user}     — Discord mention of the opener
  // {category} — Category label
  // {priority} — "⭐ Priority Ticket\n" if priority, else ""
  ticketOpenMessage:
    "{priority}Hey {user}, thanks for opening a **{category}** ticket!\n\n" +
    "Please describe your issue in as much detail as possible and a staff member will be with you shortly.\n\n" +
    "_Use the buttons below to manage your ticket._",

  // ── CLOSE CONFIRMATION MESSAGE ───────────────────────────
  closeConfirmMessage:
    "Are you sure you want to close this ticket? A transcript will be saved.",

  // ── ROLES ────────────────────────────────────────────────
  // Role IDs that can see & manage ALL tickets (staff).
  // Add as many role IDs as you need.
  staffRoleIds: [
    // "111111111111111111",  // e.g. Admin role ID
    // "222222222222222222",  // e.g. Moderator role ID
  ],

  // Role ID of the Server Booster role (Discord auto-assigns this).
  // Right-click the role in Discord → Copy ID
  boosterRoleId: null, // e.g. "333333333333333333"

  // ── TICKET LOG CHANNEL ───────────────────────────────────
  // Channel ID where closed ticket transcripts are sent.
  logChannelId: null, // e.g. "444444444444444444"

  // ── TICKET ARCHIVE CATEGORY ──────────────────────────────
  // Category ID where closed ticket channels are moved (optional).
  // Set to null to just delete channels on close instead.
  archiveCategoryId: null,

  // ── MAX OPEN TICKETS PER USER ────────────────────────────
  maxTicketsPerUser: 1,
  maxTicketsPerUserPriority: 2, // Priority users can have more open

  // ── TRANSCRIPT SETTINGS ──────────────────────────────────
  saveTranscripts: true, // Save a text transcript on ticket close
};
