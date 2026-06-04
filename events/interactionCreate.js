const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const config = require("../config/config");
const db = require("../utils/database");
const { isStaff, buildChannelName } = require("../utils/ticketHelpers");

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

    // ── OPEN TICKET ─────────────────────────────────────────
    if (customId === "ticket_open_general" || customId === "ticket_open_priority") {
      const wantsPriority = customId === "ticket_open_priority";

      if (wantsPriority) {
        const whitelisted = await db.isWhitelisted(guild.id, member.id);
        if (!whitelisted) {
          return interaction.reply({
            content: "You are not whitelisted for priority tickets.",
            ephemeral: true,
          });
        }
      }

      const openTickets = await db.getOpenTicketsByUser(guild.id, member.id);
      const limit = wantsPriority ? config.maxTicketsPerUserPriority : config.maxTicketsPerUser;

      if (openTickets.length >= limit) {
        return interaction.reply({
          content: "You already have an open ticket.",
          ephemeral: true,
        });
      }

      // Reply immediately so Discord doesn't show "thinking"
      await interaction.reply({ content: "Opening your ticket...", ephemeral: true });

      try {
        const ticketNum = await db.getNextTicketNumber(guild.id);
        const template = wantsPriority ? config.priorityTicketChannelName : config.ticketChannelName;
        const channelName = buildChannelName(template, { username: member.user.username, id: ticketNum });

        // Get saved category
        const { categoryMap } = require("../commands/ticketCategory");
        const parentId = categoryMap.get(guild.id) || null;

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

        const ticketChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: parentId,
          permissionOverwrites: permOverwrites,
        });

        await db.createTicket({
          channelId: ticketChannel.id,
          guildId: guild.id,
          userId: member.id,
          category: wantsPriority ? "priority" : "general",
          priority: wantsPriority,
        });

        // Get custom fields
        const { customFieldsMap } = require("../commands/ticketCustomize");
        const fields = customFieldsMap.get(guild.id) || config.ticketFields;

        // Build simple embed
        const embed = new EmbedBuilder()
          .setTitle(wantsPriority ? "Priority Ticket" : "Ticket Created")
          .setColor(wantsPriority ? config.colors.priority : config.colors.primary)
          .setDescription(`Opened by <@${member.id}>`)
          .setFooter({ text: config.serverName })
          .setTimestamp();

        for (const field of fields) {
          embed.addFields({ name: field.name, value: "\u200b", inline: false });
        }

        // Buttons
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("ticket_claim").setLabel("Claim").setStyle(ButtonStyle.Secondary)
        );

        // Staff ping
        const staffPing = config.staffRoleIds.map((id) => `<@&${id}>`).join(" ");

        // Send embed into ticket channel
        const msg = await ticketChannel.send({
          content: staffPing || `<@${member.id}>`,
          embeds: [embed],
          components: [row],
        });

        try { await msg.pin(); } catch {}

        // Update the ephemeral reply with the channel link
        await interaction.editReply({ content: `Your ticket has been opened: ${ticketChannel}` });

      } catch (err) {
        console.error("Ticket creation error:", err);
        await interaction.editReply({ content: `Something went wrong: ${err.message}` });
      }

      return;
    }

    // ── CLAIM ────────────────────────────────────────────────
    if (customId === "ticket_claim") {
      if (!isStaff(member)) {
        return interaction.reply({ content: "Only staff can claim tickets.", ephemeral: true });
      }
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

      return interaction.reply({
        content: "Are you sure you want to close this ticket?",
        components: [confirmRow],
        ephemeral: true,
      });
    }

    // ── CLOSE CONFIRM ────────────────────────────────────────
    if (customId === "ticket_close_confirm") {
      const ticket = await db.getTicket(channel.id);
      if (!ticket) return;

      await interaction.update({ content: "Closing...", components: [] });

      if (config.saveTranscripts && config.logChannelId) {
        try {
          const { sendTranscript } = require("../commands/ticket");
          await sendTranscript(channel, ticket, guild, "Closed via button");
        } catch {}
      }

      await db.closeTicket(channel.id, member.id);

      if (config.archiveCategoryId) {
        try {
          await channel.setParent(config.archiveCategoryId, { lockPermissions: false });
          await channel.permissionOverwrites.edit(ticket.user_id, { ViewChannel: false });
          await channel.setName(`closed-${channel.name}`);
          await channel.send("Ticket closed and archived.");
        } catch {}
      } else {
        await channel.send("Ticket closed. Channel deletes in 5 seconds.");
        setTimeout(() => channel.delete().catch(() => {}), 5000);
      }

      return;
    }

    // ── CLOSE CANCEL ─────────────────────────────────────────
    if (customId === "ticket_close_cancel") {
      return interaction.update({ content: "Cancelled.", components: [] });
    }
  },
};
