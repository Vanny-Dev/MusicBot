"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");
const { formatDuration, parseDuration } = require("../../lib/format");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Jump to a position in the current track")
    .addStringOption((option) =>
      option
        .setName("position")
        .setDescription('Where to jump to, e.g. "90", "1:30" or "1:02:03"')
        .setRequired(true),
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction, { requirePlaying: true });
    if (!context) return;

    const { queue } = context;
    const song = queue.songs[0];

    if (song.isLive) {
      await interaction.editReply({
        embeds: [embeds.warning("You cannot seek within a live stream.")],
      });
      return;
    }

    const raw = interaction.options.getString("position", true);
    const seconds = parseDuration(raw);
    if (seconds === null) {
      await interaction.editReply({
        embeds: [embeds.error('Use a timestamp like `90`, `1:30` or `1:02:03`.')],
      });
      return;
    }

    if (song.duration && seconds >= song.duration) {
      await interaction.editReply({
        embeds: [
          embeds.error(`That track is only ${song.formattedDuration} long.`),
        ],
      });
      return;
    }

    await queue.seek(seconds);
    await interaction.editReply({
      embeds: [embeds.success(`Jumped to **${formatDuration(seconds)}**.`)],
    });
  },
};
