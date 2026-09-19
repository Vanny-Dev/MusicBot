"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Shuffle the queued tracks"),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction, { requirePlaying: true });
    if (!context) return;

    const { queue } = context;
    if (queue.songs.length < 3) {
      await interaction.editReply({
        embeds: [embeds.warning("There are not enough queued tracks to shuffle.")],
      });
      return;
    }

    await queue.shuffle();
    await interaction.editReply({
      embeds: [embeds.success(`Shuffled **${queue.songs.length - 1}** queued track(s).`)],
    });
  },
};
