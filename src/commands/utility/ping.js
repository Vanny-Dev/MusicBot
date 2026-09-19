"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether the bot is responsive"),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const sent = await interaction.deferReply({ withResponse: true });

    // websocket ping is -1 until the first heartbeat has been acknowledged.
    const heartbeat = interaction.client.ws.ping;
    const roundTrip =
      (sent?.resource?.message?.createdTimestamp ?? Date.now()) - interaction.createdTimestamp;

    await interaction.editReply({
      embeds: [
        embeds.info(
          [
            `🏓 **Round trip:** ${Math.max(0, roundTrip)}ms`,
            `💓 **Gateway:** ${heartbeat < 0 ? "measuring…" : `${Math.round(heartbeat)}ms`}`,
            `⏱️ **Uptime:** ${formatUptime(interaction.client.uptime)}`,
          ].join("\n"),
        ),
      ],
    });
  },
};

/**
 * Render a millisecond uptime as `1d 2h 3m 4s`.
 * @param {number | null} ms
 * @returns {string}
 */
function formatUptime(ms) {
  const total = Math.floor((ms ?? 0) / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(" ");
}
