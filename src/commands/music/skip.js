"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");
const { songLink } = require("../../lib/format");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current track"),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction, { requirePlaying: true });
    if (!context) return;

    const { queue } = context;
    const current = queue.songs[0];

    // With nothing queued and autoplay off there is no next track, and
    // DisTube would throw NO_UP_NEXT. Stopping is the sensible reading of
    // "skip the last song".
    if (queue.songs.length <= 1 && !queue.autoplay) {
      await queue.stop();
      await interaction.editReply({
        embeds: [embeds.success(`Skipped ${songLink(current)} — the queue is now empty.`)],
      });
      return;
    }

    await queue.skip();
    await interaction.editReply({
      embeds: [embeds.success(`Skipped ${songLink(current)}`)],
    });
  },
};
