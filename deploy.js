"use strict";

/**
 * Register this bot's slash commands with Discord.
 *
 * Run it whenever a command is added, removed, or has its description or
 * options changed:
 *
 *     npm run deploy
 *
 * With GUILD_ID set in .env the commands are registered to that one server and
 * appear immediately, which is what you want while developing. Without it they
 * are registered globally, which can take up to an hour to show up everywhere.
 */

const { REST, Routes } = require("discord.js");

// Report a missing .env as a plain message rather than a stack trace.
let config;
try {
  config = require("./src/config");
} catch (error) {
  console.error(`\n✖ ${error.message}\n`);
  process.exit(1);
}

const { loadCommands } = require("./src/handlers/commandHandler");

async function main() {
  const commands = loadCommands();

  if (!commands.size) {
    console.error("[deploy] No commands found in src/commands. Nothing to register.");
    process.exitCode = 1;
    return;
  }

  const body = commands.map((command) => command.data.toJSON());
  const scope = config.guildId ? `guild ${config.guildId}` : "globally";

  console.log(`[deploy] Registering ${body.length} command(s) ${scope}...`);
  for (const command of body) console.log(`  /${command.name} — ${command.description}`);

  const rest = new REST({ version: "10" }).setToken(config.token);
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  const data = await rest.put(route, { body });
  console.log(`[deploy] Done. ${data.length} command(s) are now registered ${scope}.`);

  if (!config.guildId) {
    console.log("[deploy] Global commands can take up to an hour to appear in every server.");
  }
}

main().catch((error) => {
  console.error("[deploy] Failed to register commands.");
  if (error?.status === 401) {
    console.error("  Discord rejected the token. Check DISCORD_TOKEN in your .env file.");
  } else if (error?.status === 403) {
    console.error(
      "  Discord refused the request. Check CLIENT_ID, and make sure the bot was " +
        'invited with the "applications.commands" scope.',
    );
  } else {
    console.error(error);
  }
  process.exit(1);
});
