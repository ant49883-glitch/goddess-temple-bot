const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { buildPanelEmbed, buildPanelComponents } = require("../utils/ticketHelpers");
const { savePanelConfig, getPanelConfig } = require("../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Send or update the ticket panel in a channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("send")
        .setDescription("Send the ticket panel to a channel.")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to send the panel in.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("customize")
        .setDescription("Customize the panel embed appearance.")
        .addStringOption((opt) => opt.setName("title").setDescription("Custom embed title.").setRequired(false))
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Custom embed description (use \\n for newlines).").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("color").setDescription("Hex color code (e.g. #c084fc).").setRequired(false)
        )
        .addStringOption((opt) => opt.setName("footer").setDescription("Custom footer text.").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("refresh").setDescription("Refresh / re-send the panel in its saved channel.")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guild } = interaction;

    if (sub === "send") {
      const channel = interaction.options.getChannel("channel");
      const panelConfig = (await getPanelConfig(guild.id)) ?? {};
      const embed = buildPanelEmbed(panelConfig);
      const components = buildPanelComponents();
      const msg = await channel.send({ embeds: [embed], components });
      await savePanelConfig(guild.id, {
        channelId: channel.id,
        messageId: msg.id,
        customTitle: panelConfig.custom_title,
        customDesc: panelConfig.custom_desc,
        customColor: panelConfig.custom_color,
        customFooter: panelConfig.custom_footer,
      });
      return interaction.reply({ content: `✅ Ticket panel sent to ${channel}.`, ephemeral: true });
    }

    if (sub === "customize") {
      const title = interaction.options.getString("title");
      const desc = interaction.options.getString("description")?.replace(/\\n/g, "\n");
      const color = interaction.options.getString("color");
      const footer = interaction.options.getString("footer");

      if (!title && !desc && !color && !footer) {
        return interaction.reply({ content: "❌ Provide at least one option to customize.", ephemeral: true });
      }
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
        return interaction.reply({ content: "❌ Invalid hex color. Use format `#rrggbb`.", ephemeral: true });
      }

      const existing = (await getPanelConfig(guild.id)) ?? {};
      await savePanelConfig(guild.id, {
        channelId: existing.channel_id,
        messageId: existing.message_id,
        customTitle: title ?? existing.custom_title,
        customDesc: desc ?? existing.custom_desc,
        customColor: color ?? existing.custom_color,
        customFooter: footer ?? existing.custom_footer,
      });

      let updated = false;
      if (existing.channel_id && existing.message_id) {
        try {
          const ch = await guild.channels.fetch(existing.channel_id);
          const msg = await ch.messages.fetch(existing.message_id);
          const newConfig = await getPanelConfig(guild.id);
          await msg.edit({ embeds: [buildPanelEmbed(newConfig)], components: buildPanelComponents() });
          updated = true;
        } catch {}
      }

      return interaction.reply({
        content: `✅ Panel customization saved.${updated ? " The existing panel has been updated." : " Use `/ticket-panel send` to publish."}`,
        ephemeral: true,
      });
    }

    if (sub === "refresh") {
      const panelConfig = await getPanelConfig(guild.id);
      if (!panelConfig?.channel_id) {
        return interaction.reply({ content: "❌ No panel found. Use `/ticket-panel send` first.", ephemeral: true });
      }
      try {
        const ch = await guild.channels.fetch(panelConfig.channel_id);
        try { const old = await ch.messages.fetch(panelConfig.message_id); await old.delete(); } catch {}
        const newMsg = await ch.send({ embeds: [buildPanelEmbed(panelConfig)], components: buildPanelComponents() });
        await savePanelConfig(guild.id, {
          channelId: ch.id,
          messageId: newMsg.id,
          customTitle: panelConfig.custom_title,
          customDesc: panelConfig.custom_desc,
          customColor: panelConfig.custom_color,
          customFooter: panelConfig.custom_footer,
        });
        return interaction.reply({ content: `✅ Panel refreshed in ${ch}.`, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `❌ Failed to refresh panel: ${err.message}`, ephemeral: true });
      }
    }
  },
};
