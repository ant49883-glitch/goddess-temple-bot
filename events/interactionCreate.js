const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const config = require("../config/config");
const db = require("../utils/database");
const {
  isPriorityUser,
  buildChannelName,
  buildTicketOpenEmbed,
  buildTicketControlRow,
  isStaff,
} = require("../utils/ticketHelpers");

module.exports = {
  name: "interactionCreate",

  async execute(interaction, client) {
    // ── Slash commands ──────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error("Command error:", err);
        const msg = { content: "An error occurred.", ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      }
      return;
    }

    if (!interaction.isButton()) return;
    const { customId, guild, member, channel } = interaction;

    // ── OPEN TICKET (general or priority) ───────────────────
    if (customId === "ticket_open_general" || customId === "ticket_open_priority") {
      const wantsPriority = customId === "ticket_open_priority";

      // Priority button: only whitelisted users can open
      if (wantsPriority) {
        const whitelisted = await db.isWhitelisted(guild.id, member.id);
        if (!whitelisted) {
          return interaction.reply({
            content: "You are not whitelisted for priority tickets. Contact a staff member if you believe this is an error.",
            ephemeral: true,
          });
        }
      }

      const openTickets = await db.getOpenTicketsByUser(guild.id, member.id);
      const priority = wantsPriority;
      const limit = wantsPriority ? config.maxTicketsPerUserPriority : config.maxTicketsPerUser;

      if (openTickets.length >= limit) {
        return interaction.reply({
          content: `You already have an open ticket. Please wait for it to be resolved before opening another.`,
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const template = priority ? config.priorityTicketChannelName : config.ticketChannelName;
      const ticketNum = await db.getNextTicketNumber(guild.id);
      const channelName = buildChannelName(template, {
        username: member.user.username,
        id: ticketNum,
      });

      const permOverwrites = [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
      ];
      for (const roleId of config.staffRoleIds) {
        permOverwrites.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.AttachFiles,
          ],
        });
      }

      let ticketChannel;
      try {
        ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          topic: `${priority ? "PRIORITY | " : ""}Ticket for ${member.user.tag}`,
          permissionOverwrites: permOverwrites,
        });
      } catch (err) {
        return interaction.editReply({ content: `Could not create ticket channel: ${err.message}` });
      }

      await db.createTicket({
        channelId: ticketChannel.id,
        guildId: guild.id,
        userId: member.id,
        category: priority ? "priority" : "general",
        priority,
      });

      const ticketCustomize = require("../commands/ticketCustomize");
      const customFieldsMap = ticketCustomize.customFieldsMap;
      const customFields = customFieldsMap.get(guild.id) || config.ticketFields;

      const embed = buildTicketOpenEmbed({ user: member.user, ticketNumber: ticketNum, priority, customFields });
      const controlRow = buildTicketControlRow();

      const welcomeText = config.ticketOpenMessage.replace("{user}", `<@${member.id}>`);
      const staffMention = config.staffRoleIds.map((id) => `<@&${id}>`).join(" ");

      const openMsg = await ticketChannel.send({
        content: (staffMention ? `${staffMention}\n` : "") + welcomeText,
        embeds: [embed],
        components: [controlRow],
      });
      try { await openMsg.pin(); } catch {}

      return interaction.editReply({ content: `Your ticket has been created: ${ticketChannel}` });
    }

    // ── CLAIM ────────────────────────────────────────────────
    if (customId === "ticket_claim") {
      if (!isStaff(member)) return interaction.reply({ content: "Staff only.", ephemeral: true });
      await db.claimTicket(channel.id, member.id);
      return interaction.reply({ content: `${member} has claimed this ticket.` });
    }

    // ── CLOSE ────────────────────────────────────────────────
    if (customId === "ticket_close") {
      const ticket = await db.getTicket(channel.id);
      if (!ticket) return;
      if (!isStaff(member) && ticket.user_id !== member.id) {
        return interaction.reply({ content: "Only staff or the ticket opener can close this.", ephemeral: true });
      }
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_close_confirm").setLabel("Close Ticket").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ticket_close_cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary)
      );
      return interaction.reply({ content: config.closeConfirmMessage, components: [confirmRow], ephemeral: true });
    }

    // ── CLOSE CONFIRM ────────────────────────────────────────
    if (customId === "ticket_close_confirm") {
      const ticket = await db.getTicket(channel.id);
      if (!ticket) return;
      await interaction.update({ content: "Closing ticket...", components: [] });
      if (config.saveTranscripts && config.logChannelId) {
        const { sendTranscript } = require("../commands/ticket");
        await sendTranscript(channel, ticket, guild, "Closed via button");
      }
      await db.closeTicket(channel.id, member.id);
      if (config.archiveCategoryId) {
        try {
          await channel.setParent(config.archiveCategoryId, { lockPermissions: false });
          await channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: false });
          await channel.setName(`closed-${channel.name}`);
          await channel.send({ content: "Ticket closed and archived." });
        } catch {}
      } else {
        await channel.send({ content: "Ticket closed. This channel will be deleted in 5 seconds." });
        setTimeout(() => channel.delete().catch(() => {}), 5000);
      }
    }

    // ── CLOSE CANCEL ─────────────────────────────────────────
    if (customId === "ticket_close_cancel") {
      return interaction.update({ content: "Cancelled.", components: [] });
    }
  },
};
