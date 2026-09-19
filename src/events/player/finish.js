"use strict";

const embeds = require("../../lib/embeds");
const { safeSend } = require("../../lib/send");

module.exports = {
  name: "finish",

  /**
   * The queue played through to the end. The actual auto-leave is handled by
   * the `deleteQueue` event, which also covers /stop and exhausted autoplay.
   *
   * @param {import("distube").Queue} queue
   */
  async execute(queue) {
    await safeSend(queue.textChannel, {
      embeds: [embeds.info("🏁 Queue finished. Add something with `/play`.")],
    });
  },
};
