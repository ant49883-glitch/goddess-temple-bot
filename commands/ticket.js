const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { getTicket, closeTicket, claimTicket } = require("../utils/database");
const { isStaff, buildTranscript } = require("../utils/ticketHelpers");
const config = require("../config/config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage tickets.")
    .addSubcommand((sub) =>
      sub.setName("close").setDescription("Close the current ticket.")
        .addStringOption((opt) => opt.setName("reason").setDescription("Reason for closing.").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("add").setDescription("Add a user to this ticket.")
        .addUserOption((opt) => opt.setName("user").setDescription("User to add.").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("remove").setDescription("Remove a user from this ticket.")
        .addUserOption((opt) => opt.setName("user").setDescription("User to remove.").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("rename").setDescription("Rename the ticket channel.")
        .addStringOption((opt) => opt.setName("name").setDescription("New channel name.").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("claim").setDescription("Claim this ticket."))
    .addSubcommand((sub) => sub.setName("unclaim").setDescription("Unclaim this ticket."))
    .addSubcommand((sub) => sub.setName("info").setDescription("View info about this ticket."))
    .addSubcommand((sub) => sub.setName("transcript").setDescription("Save a transcript of this ticket.")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { channel, guild, member } = interaction;

    const ticket = await getTicket(channel.id);
    const staffMember = isStaff(member);

    if (!ticket) {
      return interaction.reply({ content: "❌ This command can only be used inside a ticket channel.", ephemeral: true });
    }

    if (sub === "close") {
      if (!staffMember && ticket.user_id !== member.id) {
        return interaction.reply({ content: "❌ Only staff or the ticket opener can close this ticket.", ephemeral: true });
      }
      const reason = interaction.options.getString("reason") ?? "No reason provided.";
      await interaction.reply({ content: `🔒 Closing ticket... **Reason:** ${reason}` });
      if (config.saveTranscripts) await sendTranscript(channel, ticket, guild, reason);
      await closeTicket(channel.id, member.id);
      if (config.archiveCategoryId) {
        try {
          await channel.setParent(config.archiveCategoryId, { lockPermissions: false });
          await channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: false });
          await channel.setName(`closed-${channel.name}`);
        } catch {}
      } else {
        setTimeout(() => channel.delete().catch(() => {}), 5000);
      }
    }

    if (sub === "add") {
      if (!staffMember) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      const user = interaction.options.getUser("user");
      try {
        await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
        return interaction.reply({ content: `✅ Added ${user} to the ticket.` });
      } catch (e) { return interaction.reply({ content: `❌ Failed: ${e.message}`, ephemeral: true }); }
    }

    if (sub === "remove") {
      if (!staffMember) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      const user = interaction.options.getUser("user");
      if (user.id === ticket.user_id) return interaction.reply({ content: "❌ You can't remove the ticket opener.", ephemeral: true });
      try {
        await channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
        return interaction.reply({ content: `✅ Removed ${user} from the ticket.` });
      } catch (e) { return interaction.reply({ content: `❌ Failed: ${e.message}`, ephemeral: true }); }
    }

    if (sub === "rename") {
      if (!staffMember) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      const name = interaction.options.getString("name").toLowerCase().replace(/\s+/g, "-");
      try {
        await channel.setName(name);
        return interaction.reply({ content: `✅ Channel renamed to **${name}**.` });
      } catch (e) { return interaction.reply({ content: `❌ Failed: ${e.message}`, ephemeral: true }); }
    }

    if (sub === "claim") {
      if (!staffMember) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      await claimTicket(channel.id, member.id);
      return interaction.reply({ content: `🙋 ${member} has claimed this ticket.` });
    }

    if (sub === "unclaim") {
      if (!staffMember) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      await claimTicket(channel.id, null);
      return interaction.reply({ content: `🔓 This ticket is now unclaimed.` });
    }

    if (sub === "info") {
      const cat = config.ticketCategories.find((c) => c.id === ticket.category);
      const embed = new EmbedBuilder()
        .setTitle("📋 Ticket Info")
        .setColor(ticket.priority ? config.colors.priority : config.colors.primary)
        .addFields(
          { name: "Ticket #", value: String(ticket.id), inline: true },
          { name: "Category", value: cat?.label ?? ticket.category, inline: true },
          { name: "Priority", value: ticket.priority ? "⭐ Yes" : "Standard", inline: true },
          { name: "Opened By", value: `<@${ticket.user_id}>`, inline: true },
          { name: "Claimed By", value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : "Unclaimed", inline: true },
          { name: "Status", value: ticket.status, inline: true },
          { name: "Opened At", value: String(ticket.created_at), inline: false }
        )
        .setFooter({ text: `${config.serverName} • Ticket System` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "transcript") {
      if (!staffMember) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      await sendTranscript(channel, ticket, guild, "Manual save");
      return interaction.editReply({ content: "✅ Transcript saved to log channel." });
    }
  },
};

async function sendTranscript(channel, ticket, guild, reason) {
  if (!config.logChannelId) return;
  try {
    const logChannel = await guild.channels.fetch(config.logChannelId);
    const transcript = await buildTranscript(channel, ticket);
    const buffer = Buffer.from(transcript, "utf-8");
    const attachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.txt` });
    const embed = new EmbedBuilder()
      .setTitle("📄 Ticket Closed")
      .setColor(config.colors.closed)
      .addFields(
        { name: "Channel", value: channel.name, inline: true },
        { name: "Opened By", value: `<@${ticket.user_id}>`, inline: true },
        { name: "Category", value: ticket.category, inline: true },
        { name: "Priority", value: ticket.priority ? "⭐ Yes" : "Standard", inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `${config.serverName} • Transcript` });
    await logChannel.send({ embeds: [embed], files: [attachment] });
  } catch (err) { console.error("Failed to send transcript:", err); }
}

module.exports.sendTranscript = sendTranscript;
