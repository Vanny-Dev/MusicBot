"use strict";

const embeds = require("../../lib/embeds");
const { safeSend } = require("../../lib/send");
const { escapeMarkdown, truncate } = require("../../lib/format");

module.exports = {
  name: "addList",

  /**
   * @param {import("distube").Queue} queue
   * @param {import("distube").Playlist} playlist
   */
  async execute(queue, playlist) {
    const name = escapeMarkdown(truncate(playlist.name ?? "Unknown playlist", 70));
    const title = playlist.url ? `[${name}](${playlist.url})` : name;
    await safeSend(queue.textChannel, {
      embeds: [
        embeds.success(
          `Added **${playlist.songs.length}** track(s) from ${title} (${playlist.formattedDuration})`,
        ),
      ],
    });
  },
};
