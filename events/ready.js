module.exports = {
  name: "ready",
  once: true,
  execute(client) {
    console.log(`\n✨ Goddess Temple Bot is online as ${client.user.tag}`);
    console.log(`   Serving: ${client.guilds.cache.size} server(s)\n`);
    client.user.setActivity("Goddess Temple 🌸", { type: 3 }); // Watching
  },
};
