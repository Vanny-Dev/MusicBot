"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");
const { songLink } = require("../../lib/format");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("jump")
    .setDescription("Jump straight to a queued track")
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setDescription("Position in the queue, as shown by /queue")
        .setMinValue(1)
        .setRequired(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("requeue")
        .setDescription("Move the skipped tracks to the end instead of dropping them")
        .setRequired(false),
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
    const requeue = interaction.options.getBoolean("requeue") ?? false;

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

    const song = await queue.jump(position, { requeue });
    await interaction.editReply({
      embeds: [embeds.success(`Jumping to ${songLink(song)}`)],
    });
  },
};
