"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");
const { songLink } = require("../../lib/format");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a queued track")
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setDescription("Position in the queue, as shown by /queue")
        .setMinValue(1)
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
    const position = interaction.options.getInteger("position", true);

    // queue.songs[0] is the track that is playing, so /queue position 1 maps
    // to index 1. Use /skip to get rid of the current track.
    if (position >= queue.songs.length) {
      await interaction.editReply({
        embeds: [
          embeds.error(
            queue.songs.length > 1
              ? `There are only ${queue.songs.length - 1} queued track(s).`
              : "There is nothing queued after the current track.",
          ),
        ],
      });
      return;
    }

    const [removed] = queue.songs.splice(position, 1);
    await interaction.editReply({
      embeds: [embeds.success(`Removed ${songLink(removed)} from the queue.`)],
    });
  },
};
