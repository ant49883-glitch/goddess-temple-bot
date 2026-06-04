const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const config = require("../config/config");
const db = require("./database");

// ── Priority check ───────────────────────────────────────────
async function isPriorityUser(guild, member) {
  // Check whitelist
  if (db.isWhitelisted(guild.id, member.id)) return true;

  // Check booster role
  if (config.boosterRoleId && member.roles.cache.has(config.boosterRoleId))
    return true;

  // Check Discord nitro booster natively
  if (member.premiumSince) return true;

  return false;
}

// ── Channel name builder ─────────────────────────────────────
function buildChannelName(template, { username, id, category }) {
  const paddedId = String(id).padStart(4, "0");
  return template
    .replace("{username}", username.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .replace("{id}", paddedId)
    .replace("{category}", category)
    .slice(0, 100); // Discord channel name limit
}

// ── Build ticket panel embed & components ───────────────────
function buildPanelEmbed(customizations = {}) {
  const title = customizations.custom_title || config.panel.title;
  const desc = customizations.custom_desc || config.panel.description;
  const color = customizations.custom_color || config.colors.primary;
  const footer = customizations.custom_footer || config.panel.footer;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setFooter({ text: footer })
    .setTimestamp();

  if (config.panel.thumbnailUrl) embed.setThumbnail(config.panel.thumbnailUrl);

  return embed;
}

function buildPanelComponents() {
  const rows = [];
  const cats = config.ticketCategories;

  // Discord allows max 5 buttons per row, 5 rows per message
  for (let i = 0; i < cats.length; i += 5) {
    const row = new ActionRowBuilder();
    const chunk = cats.slice(i, i + 5);
    for (const cat of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_open_${cat.id}`)
          .setLabel(cat.label)
          .setEmoji(cat.emoji)
          .setStyle(ButtonStyle[cat.style] ?? ButtonStyle.Primary)
      );
    }
    rows.push(row);
  }

  return rows;
}

// ── Build ticket channel opening embed ───────────────────────
function buildTicketOpenEmbed({ user, category, priority, ticketNumber }) {
  const cat = config.ticketCategories.find((c) => c.id === category);
  const color = priority ? config.colors.priority : config.colors.primary;

  const msg = config.ticketOpenMessage
    .replace("{user}", `<@${user.id}>`)
    .replace("{category}", cat?.label ?? category)
    .replace("{priority}", priority ? "⭐ **Priority Ticket**\n\n" : "");

  const embed = new EmbedBuilder()
    .setTitle(
      `${priority ? "⭐ " : ""}${cat?.emoji ?? "🎫"} ${cat?.label ?? category} — Ticket #${String(ticketNumber).padStart(4, "0")}`
    )
    .setDescription(msg)
    .setColor(color)
    .setFooter({ text: `${config.serverName} • Ticket System` })
    .setTimestamp()
    .addFields(
      { name: "Opened By", value: `<@${user.id}>`, inline: true },
      { name: "Category", value: cat?.label ?? category, inline: true },
      {
        name: "Priority",
        value: priority ? "⭐ Yes" : "Standard",
        inline: true,
      }
    );

  return embed;
}

function buildTicketControlRow(ticketChannelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Claim")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close Ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket_transcript")
      .setLabel("Save Transcript")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Secondary)
  );
}

// ── Build transcript text ────────────────────────────────────
async function buildTranscript(channel, ticket) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );

  const header =
    `═══════════════════════════════════════\n` +
    `   GODDESS TEMPLE — TICKET TRANSCRIPT\n` +
    `═══════════════════════════════════════\n` +
    `Ticket #${ticket.id}\n` +
    `Channel: #${channel.name}\n` +
    `Opened By: ${ticket.user_id}\n` +
    `Category: ${ticket.category}\n` +
    `Priority: ${ticket.priority ? "Yes" : "No"}\n` +
    `Opened: ${ticket.created_at}\n` +
    `Closed: ${new Date().toISOString()}\n` +
    `═══════════════════════════════════════\n\n`;

  const body = sorted
    .map((m) => {
      const time = new Date(m.createdTimestamp).toISOString();
      const content = m.content || "[embed/attachment]";
      return `[${time}] ${m.author.tag}: ${content}`;
    })
    .join("\n");

  return header + body;
}

// ── Staff permission check ───────────────────────────────────
function isStaff(member) {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (
    config.staffRoleIds.length &&
    config.staffRoleIds.some((id) => member.roles.cache.has(id))
  )
    return true;
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
