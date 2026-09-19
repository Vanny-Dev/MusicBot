"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");
const { cancelLeave } = require("../../lib/idle");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Stop playing and leave the voice channel"),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction);
    if (!context) return;

    const { distube } = interaction.client;

    if (!interaction.guild.members.me?.voice?.channelId) {
      await interaction.editReply({
        embeds: [embeds.warning("I am not in a voice channel.")],
      });
      return;
    }

    // Drop the idle timer first so it cannot fire against a later session.
    cancelLeave(interaction.guildId);
    if (context.queue) await context.queue.stop();
    distube.voices.leave(interaction.guildId);

    await interaction.editReply({
      embeds: [embeds.success("Left the voice channel.")],
    });
  },
};
