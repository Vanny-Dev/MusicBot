"use strict";

const { EmbedBuilder } = require("discord.js");

const config = require("../../config");
const { cancelLeave } = require("../../lib/idle");
const { safeSend } = require("../../lib/send");
const { escapeMarkdown, truncate } = require("../../lib/format");

module.exports = {
  name: "playSong",

  /**
   * @param {import("distube").Queue} queue
   * @param {import("distube").Song} song
   * @param {import("discord.js").Client} client
   */
  async execute(queue, song, client) {
    // Music is playing again, so call off any pending auto-leave.
    cancelLeave(queue.id);

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setAuthor({ name: "Now playing" })
      .setTitle(truncate(song.name ?? "Unknown track", 240))
      .setFooter({
        text: `Requested by ${song.user?.displayName ?? song.user?.username ?? "autoplay"}`,
        iconURL: song.user?.displayAvatarURL?.(),
      });

    if (song.url) embed.setURL(song.url);
    if (song.thumbnail) embed.setThumbnail(song.thumbnail);

    embed.addFields(
      {
        name: "Duration",
        value: song.isLive ? "🔴 Live" : song.formattedDuration || "Unknown",
        inline: true,
      },
      {
        name: "Uploader",
        value: song.uploader?.name ? escapeMarkdown(truncate(song.uploader.name, 40)) : "Unknown",
        inline: true,
      },
      {
        name: "Volume",
        value: `${queue.volume}%`,
        inline: true,
      },
    );

    if (queue.songs.length > 1) {
      embed.addFields({
        name: "Up next",
        value: truncate(escapeMarkdown(queue.songs[1].name ?? "Unknown track"), 60),
      });
    }

    await safeSend(queue.textChannel, { embeds: [embed] });
  },
};
