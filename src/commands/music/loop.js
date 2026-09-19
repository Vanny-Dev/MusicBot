"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { RepeatMode } = require("distube");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");

const LABELS = {
  [RepeatMode.DISABLED]: "Repeat is **off**.",
  [RepeatMode.SONG]: "Repeating **this track**.",
  [RepeatMode.QUEUE]: "Repeating **the whole queue**.",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Set the repeat mode")
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("What to repeat")
        .setRequired(true)
        .addChoices(
          { name: "Off", value: "off" },
          { name: "This track", value: "song" },
          { name: "Whole queue", value: "queue" },
        ),
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction, { requireQueue: true });
    if (!context) return;

    const modes = {
      off: RepeatMode.DISABLED,
      song: RepeatMode.SONG,
      queue: RepeatMode.QUEUE,
    };
    const mode = modes[interaction.options.getString("mode", true)];

    const applied = context.queue.setRepeatMode(mode);
    await interaction.editReply({ embeds: [embeds.success(LABELS[applied])] });
  },
};
