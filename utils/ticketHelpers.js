const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const config = require("../config/config");
const db = require("./database");

async function isPriorityUser(guild, member) {
  if (await db.isWhitelisted(guild.id, member.id)) return true;
  if (config.boosterRoleId && member.roles.cache.has(config.boosterRoleId)) return true;
  if (member.premiumSince) return true;
  return false;
}

function buildChannelName(template, { username, id }) {
  const paddedId = String(id).padStart(4, "0");
  return template
    .replace("{username}", username.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .replace("{id}", paddedId)
    .slice(0, 100);
}

// ── Panel embed ───────────────────────────────────────────
function buildPanelEmbed(customizations = {}) {
  const title = customizations.custom_title || config.panel.title;
  const desc = customizations.custom_desc || config.panel.description;
  const color = customizations.custom_color || config.colors.primary;
  const footer = customizations.custom_footer || config.panel.footer;

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setFooter({ text: footer })
    .setTimestamp();
}

// ── Two buttons: Open a Ticket + Priority Ticket ──────────
function buildPanelComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_open_general")
      .setLabel("Open a Ticket")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_open_priority")
      .setLabel("Priority Ticket")
      .setStyle(ButtonStyle.Danger)
  );
  return [row];
}

// ── Ticket open embed — clean, no emojis ──────────────────
function buildTicketOpenEmbed({ user, ticketNumber, priority, customFields }) {
  const fields = customFields || config.ticketFields;
  const color = priority ? config.colors.priority : config.colors.primary;

  const embed = new EmbedBuilder()
    .setTitle(priority ? "Priority Ticket Created" : "Ticket Created")
    .setColor(color)
    .setDescription(`Opened by <@${user.id}>`)
    .setFooter({ text: `${config.serverName} | ${priority ? "Priority Support" : "Support"}` })
    .setTimestamp();

  for (const field of fields) {
    embed.addFields({ name: field.name, value: field.value || "\u200b", inline: false });
  }

  return embed;
}

// ── Ticket control buttons — no emojis ───────────────────
function buildTicketControlRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Claim")
      .setStyle(ButtonStyle.Secondary)
  );
}

// ── Transcript ────────────────────────────────────────────
async function buildTranscript(channel, ticket) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const header =
    `GODDESS TEMPLE — TICKET TRANSCRIPT\n` +
    `Ticket #${ticket.id} | Opened by: ${ticket.user_id}\n` +
    `Opened: ${ticket.created_at} | Closed: ${new Date().toISOString()}\n` +
    `${"─".repeat(50)}\n\n`;

  const body = sorted
    .map((m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || "[embed/attachment]"}`)
    .join("\n");

  return header + body;
}

function isStaff(member) {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (config.staffRoleIds.length && config.staffRoleIds.some((id) => member.roles.cache.has(id))) return true;
  return false;
}

module.exports = {
  isPriorityUser,
  buildChannelName,
  buildPanelEmbed,
  buildPanelComponents,
  buildTicketOpenEmbed,
  buildTicketControlRow,
  buildTranscript,
  isStaff,
};
