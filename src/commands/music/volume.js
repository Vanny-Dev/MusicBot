"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Show or change the playback volume")
    .addIntegerOption((option) =>
      option
        .setName("percent")
        .setDescription("New volume, from 0 to 150")
        .setMinValue(0)
        .setMaxValue(150)
        .setRequired(false),
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction, { requireQueue: true });
    if (!context) return;

    const { queue } = context;
    const percent = interaction.options.getInteger("percent");

    if (percent === null) {
      await interaction.editReply({
        embeds: [embeds.info(`🔊 The volume is **${queue.volume}%**.`)],
      });
      return;
    }

    queue.setVolume(percent);
    await interaction.editReply({
      embeds: [embeds.success(`Volume set to **${percent}%**.`)],
    });
  },
};
