"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { defaultFilters } = require("distube");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");

// Discord allows up to 25 choices; DisTube ships 15 filters, so they all fit.
const FILTER_CHOICES = Object.keys(defaultFilters).map((name) => ({
  name,
  value: name,
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("filter")
    .setDescription("Toggle an audio filter, or clear them all")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription('Filter to toggle, or "off" to clear every filter')
        .setRequired(true)
        .addChoices({ name: "off (clear all)", value: "off" }, ...FILTER_CHOICES),
    ),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction, { requirePlaying: true });
    if (!context) return;

    const { queue } = context;
    const name = interaction.options.getString("name", true);

    if (name === "off") {
      if (!queue.filters.names.length) {
        await interaction.editReply({
          embeds: [embeds.warning("No filters are active.")],
        });
        return;
      }
      queue.filters.clear();
      await interaction.editReply({
        embeds: [embeds.success("Cleared every audio filter.")],
      });
      return;
    }

    const wasActive = queue.filters.has(name);
    if (wasActive) queue.filters.remove(name);
    else queue.filters.add(name);

    const active = queue.filters.names;
    await interaction.editReply({
      embeds: [
        embeds.success(
          `${wasActive ? "Disabled" : "Enabled"} **${name}**.\n` +
            `Active filters: ${active.length ? active.join(", ") : "none"}`,
        ),
      ],
    });
  },
};
