"use strict";

const { ActivityType, Events } = require("discord.js");

const config = require("../../config");

module.exports = {
  name: Events.ClientReady,
  once: true,

  /**
   * @param {import("discord.js").Client} readyClient
   */
  execute(readyClient) {
    console.log(`[bot] Logged in as ${readyClient.user.tag}`);
    console.log(`[bot] Serving ${readyClient.guilds.cache.size} guild(s)`);
    console.log(`[bot] Loaded ${readyClient.commands.size} command(s)`);
    console.log(
      config.prefix
        ? `[bot] Prefix commands enabled: "${config.prefix}"`
        : "[bot] Prefix commands disabled (slash commands only)",
    );

    readyClient.user.setPresence({
      activities: [
        { name: config.prefix ? `${config.prefix}play or /play` : "/play", type: ActivityType.Listening },
      ],
      status: "online",
    });
  },
};
