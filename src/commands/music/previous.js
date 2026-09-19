"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");
const { songLink } = require("../../lib/format");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("previous")
    .setDescription("Go back to the previous track"),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction, { requireQueue: true });
    if (!context) return;

    const { queue } = context;
    if (!queue.previousSongs.length) {
      await interaction.editReply({
        embeds: [embeds.warning("There is no previous track to go back to.")],
      });
      return;
    }

    const song = await queue.previous();
    await interaction.editReply({
      embeds: [embeds.success(`Going back to ${songLink(song)}`)],
    });
  },
};
