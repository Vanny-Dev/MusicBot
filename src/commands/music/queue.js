"use strict";

const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const config = require("../../config");
const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");
const {
  formatDuration,
  joinWithinLimit,
  progressBar,
  songLink,
} = require("../../lib/format");

const PAGE_SIZE = 10;

const REPEAT_LABELS = ["Off", "This track", "Whole queue"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current queue")
    .addIntegerOption((option) =>
      option
        .setName("page")
        .setDescription("Which page of the queue to show")
        .setMinValue(1)
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
    const [current, ...upcoming] = queue.songs;

    const pageCount = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
    const requested = interaction.options.getInteger("page") ?? 1;
    const page = Math.min(requested, pageCount);
    const start = (page - 1) * PAGE_SIZE;
    const slice = upcoming.slice(start, start + PAGE_SIZE);

    const elapsed = queue.currentTime;
    const nowPlaying = [
      songLink(current, 70),
      current.isLive
        ? "🔴 Live"
        : `\`${progressBar(elapsed, current.duration)}\` ` +
          `\`${formatDuration(elapsed)} / ${current.formattedDuration}\``,
    ].join("\n");

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle(`Queue for ${interaction.guild.name}`)
      .addFields({ name: queue.paused ? "Paused" : "Now playing", value: nowPlaying });

    if (slice.length) {
      embed.addFields({
        name: "Up next",
        value: joinWithinLimit(
          slice.map((song, index) => {
            const position = start + index + 1;
            const length = song.isLive ? "LIVE" : song.formattedDuration;
            return `\`${position}.\` ${songLink(song, 45)} \`[${length}]\``;
          }),
        ),
      });
    } else if (upcoming.length === 0) {
      embed.addFields({
        name: "Up next",
        value: queue.autoplay
          ? "_Nothing queued — autoplay will pick something._"
          : "_Nothing queued._",
      });
    }

    embed.addFields(
      { name: "Tracks", value: String(queue.songs.length), inline: true },
      { name: "Total length", value: queue.formattedDuration || "0:00", inline: true },
      { name: "Volume", value: `${queue.volume}%`, inline: true },
      { name: "Repeat", value: REPEAT_LABELS[queue.repeatMode] ?? "Off", inline: true },
      { name: "Autoplay", value: queue.autoplay ? "On" : "Off", inline: true },
      {
        name: "Filters",
        value: queue.filters.names.length ? queue.filters.names.join(", ") : "None",
        inline: true,
      },
    );

    embed.setFooter({ text: `Page ${page} of ${pageCount}` });

    if (requested > pageCount) {
      await interaction.editReply({
        embeds: [embeds.warning(`There ${pageCount === 1 ? "is" : "are"} only ${pageCount} page(s).`), embed],
      });
      return;
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
