"use strict";

const { Events, MessageFlags } = require("discord.js");
const embeds = require("../../lib/embeds");

module.exports = {
  name: Events.InteractionCreate,

  /**
   * @param {import("discord.js").Interaction} interaction
   * @param {import("discord.js").Client} client
   */
  async execute(interaction, client) {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (typeof command?.autocomplete !== "function") return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`[commands] Autocomplete failed for /${interaction.commandName}:`, error);
        // Discord expects a response; an empty list is the graceful answer.
        if (!interaction.responded) await interaction.respond([]).catch(() => {});
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[commands] Received unknown command /${interaction.commandName}`);
      return;
    }

    if (!interaction.inGuild()) {
      await interaction.reply({
        embeds: [embeds.error("Music commands only work inside a server.")],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`[commands] Error running /${interaction.commandName}:`, error);

      const payload = {
        embeds: [embeds.error("Something went wrong while running that command.")],
      };
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload);
        } else {
          await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
        }
      } catch {
        // The interaction token expired; nothing left to do but the log above.
      }
    }
  },
};
