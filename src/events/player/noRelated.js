"use strict";

const embeds = require("../../lib/embeds");
const { safeSend } = require("../../lib/send");

module.exports = {
  name: "noRelated",

  /**
   * Autoplay was on but nothing related could be found, so playback stops.
   *
   * @param {import("distube").Queue} queue
   */
  async execute(queue) {
    await safeSend(queue.textChannel, {
      embeds: [embeds.warning("Autoplay could not find a related track, so the queue stopped.")],
    });
  },
};
