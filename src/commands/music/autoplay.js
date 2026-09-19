"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle playing related tracks once the queue runs out"),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction, { requireQueue: true });
    if (!context) return;

    const enabled = context.queue.toggleAutoplay();
    await interaction.editReply({
      embeds: [
        embeds.success(
          enabled
            ? "Autoplay is **on** — I will keep playing related tracks."
            : "Autoplay is **off**.",
        ),
      ],
    });
  },
};
