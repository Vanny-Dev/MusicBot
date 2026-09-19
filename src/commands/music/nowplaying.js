"use strict";

const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const config = require("../../config");
const { requireVoice } = require("../../lib/guards");
const { formatDuration, progressBar, truncate } = require("../../lib/format");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show what is playing right now"),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction, { requirePlaying: true });
    if (!context) return;

    const { queue } = context;
    const song = queue.songs[0];
    const elapsed = queue.currentTime;

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setAuthor({ name: queue.paused ? "Paused" : "Now playing" })
      .setTitle(truncate(song.name ?? "Unknown track", 240));

    if (song.url) embed.setURL(song.url);
    if (song.thumbnail) embed.setThumbnail(song.thumbnail);

    embed.setDescription(
      song.isLive
        ? "🔴 Live stream"
        : `\`${progressBar(elapsed, song.duration)}\`\n` +
          `\`${formatDuration(elapsed)} / ${song.formattedDuration}\``,
    );

    embed.addFields(
      { name: "Uploader", value: truncate(song.uploader?.name ?? "Unknown", 40), inline: true },
      { name: "Volume", value: `${queue.volume}%`, inline: true },
      { name: "Queued", value: `${queue.songs.length} track(s)`, inline: true },
    );

    if (song.user) {
      embed.setFooter({
        text: `Requested by ${song.user.displayName ?? song.user.username}`,
        iconURL: song.user.displayAvatarURL?.(),
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
