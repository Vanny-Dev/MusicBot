"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");
const { songLink } = require("../../lib/format");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Resume a paused track"),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction, { requirePlaying: true });
    if (!context) return;

    const { queue } = context;
    if (!queue.paused) {
      await interaction.editReply({
        embeds: [embeds.warning("Playback is not paused.")],
      });
      return;
    }

    await queue.resume();
    await interaction.editReply({
      embeds: [embeds.success(`Resumed ${songLink(queue.songs[0])}`)],
    });
  },
};
