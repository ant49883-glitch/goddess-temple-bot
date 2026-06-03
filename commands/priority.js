const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { addToWhitelist, removeFromWhitelist, getWhitelist } = require("../utils/database");
const config = require("../config/config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("priority")
    .setDescription("Manage priority ticket whitelist.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Whitelist a user for priority tickets.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User to whitelist.").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a user from the priority whitelist.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("User to remove.").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("View all whitelisted users.")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guild } = interaction;

    if (sub === "add") {
      const user = interaction.options.getUser("user");
      const added = await addToWhitelist(guild.id, user.id, interaction.user.id);
      if (!added) {
        return interaction.reply({ content: `⚠️ ${user} is already on the priority whitelist.`, ephemeral: true });
      }
      return interaction.reply({
        content: `✅ ${user} has been added to the **priority ticket whitelist**.`,
        ephemeral: true,
      });
    }

    if (sub === "remove") {
      const user = interaction.options.getUser("user");
      const removed = await removeFromWhitelist(guild.id, user.id);
      if (!removed) {
        return interaction.reply({ content: `⚠️ ${user} was not on the priority whitelist.`, ephemeral: true });
      }
      return interaction.reply({ content: `✅ ${user} has been removed from the priority whitelist.`, ephemeral: true });
    }

    if (sub === "list") {
      const whitelist = await getWhitelist(guild.id);
      const embed = new EmbedBuilder()
        .setTitle("⭐ Priority Ticket Whitelist")
        .setColor(config.colors.priority)
        .setFooter({ text: `${config.serverName} • Priority System` })
        .setTimestamp();

      if (!whitelist.length) {
        embed.setDescription("No users are currently whitelisted.");
      } else {
        const lines = whitelist.map(
          (row, i) =>
            `**${i + 1}.** <@${row.user_id}> — added by <@${row.added_by}> on ${new Date(row.added_at).toLocaleDateString()}`
        );
        embed.setDescription(lines.join("\n"));
      }

      embed.addFields({
        name: "Also Eligible",
        value: config.boosterRoleId
          ? `<@&${config.boosterRoleId}> (Server Boosters)`
          : "Server Boosters (Nitro Boosters) — set `boosterRoleId` in config.",
        inline: false,
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
