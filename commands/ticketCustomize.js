const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const config = require("../config/config");

// This command lets admins preview what a ticket will look like
// and set a custom welcome message per category.

const customMessages = new Map(); // In-memory; persist in DB if desired

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-customize")
    .setDescription("Customize ticket appearance per category.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("welcome")
        .setDescription("Set a custom welcome message for a ticket category.")
        .addStringOption((opt) => {
          const o = opt
            .setName("category")
            .setDescription("Which ticket category to customize.")
            .setRequired(true);
          for (const cat of config.ticketCategories) {
            o.addChoices({ name: `${cat.emoji} ${cat.label}`, value: cat.id });
          }
          return o;
        })
        .addStringOption((opt) =>
          opt
            .setName("message")
            .setDescription(
              "Custom welcome message. Use {user} for mention, \\n for newline."
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("View current customizations.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Reset a category to default message.")
        .addStringOption((opt) => {
          const o = opt
            .setName("category")
            .setDescription("Category to reset.")
            .setRequired(true);
          for (const cat of config.ticketCategories) {
            o.addChoices({ name: `${cat.emoji} ${cat.label}`, value: cat.id });
          }
          return o;
        })
    ),

  customMessages, // export so ticket open handler can access it

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "welcome") {
      const catId = interaction.options.getString("category");
      const msg = interaction.options
        .getString("message")
        .replace(/\\n/g, "\n");

      customMessages.set(catId, msg);

      const cat = config.ticketCategories.find((c) => c.id === catId);
      return interaction.reply({
        content:
          `✅ Custom welcome message set for **${cat?.label ?? catId}**:\n\n>>> ${msg.replace("{user}", "@user")}`,
        ephemeral: true,
      });
    }

    if (sub === "view") {
      if (!customMessages.size) {
        return interaction.reply({
          content: "No custom messages set. All categories use the default from `config.js`.",
          ephemeral: true,
        });
      }
      const lines = [];
      for (const [catId, msg] of customMessages.entries()) {
        const cat = config.ticketCategories.find((c) => c.id === catId);
        lines.push(`**${cat?.label ?? catId}**\n> ${msg.replace("{user}", "@user")}`);
      }
      return interaction.reply({
        content: lines.join("\n\n"),
        ephemeral: true,
      });
    }

    if (sub === "reset") {
      const catId = interaction.options.getString("category");
      customMessages.delete(catId);
      const cat = config.ticketCategories.find((c) => c.id === catId);
      return interaction.reply({
        content: `✅ **${cat?.label ?? catId}** reset to default message.`,
        ephemeral: true,
      });
    }
  },
};
