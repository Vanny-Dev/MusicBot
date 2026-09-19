"use strict";

const embeds = require("../../lib/embeds");
const { safeSend } = require("../../lib/send");
const { songLink } = require("../../lib/format");

module.exports = {
  name: "addSong",

  /**
   * @param {import("distube").Queue} queue
   * @param {import("distube").Song} song
   */
  async execute(queue, song) {
    const position = queue.songs.indexOf(song);
    const suffix = position > 0 ? ` — position ${position} in the queue` : "";
    await safeSend(queue.textChannel, {
      embeds: [embeds.success(`Added ${songLink(song)}${suffix}`)],
    });
  },
};
