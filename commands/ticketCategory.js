const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

// Stores the Discord category ID per guild where tickets go
const categoryMap = new Map();

module.exports = {
  categoryMap,

  data: new SlashCommandBuilder()
    .setName("ticket-category")
    .setDescription("Set which Discord category new ticket channels are created in.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Set the category for ticket channels.")
        .addChannelOption((opt) =>
          opt
            .setName("category")
            .setDescription("The category to create tickets in.")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("remove").setDescription("Remove the category — tickets will be created without one.")
    )
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("View the current ticket category.")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guild } = interaction;

    if (sub === "set") {
      const category = interaction.options.getChannel("category");
      categoryMap.set(guild.id, category.id);
      return interaction.reply({
        content: `Ticket channels will now be created inside **${category.name}**.`,
        ephemeral: true,
      });
    }

    if (sub === "remove") {
      categoryMap.delete(guild.id);
      return interaction.reply({
        content: "Ticket category removed. Channels will be created without a category.",
        ephemeral: true,
      });
    }

    if (sub === "view") {
      const categoryId = categoryMap.get(guild.id);
      if (!categoryId) {
        return interaction.reply({ content: "No ticket category set.", ephemeral: true });
      }
      try {
        const category = await guild.channels.fetch(categoryId);
        return interaction.reply({ content: `Tickets are currently created in **${category.name}**.`, ephemeral: true });
      } catch {
        return interaction.reply({ content: "Saved category no longer exists. Use `/ticket-category set` to set a new one.", ephemeral: true });
      }
    }
  },
};
