"use strict";

const { scheduleLeaveOnFinish } = require("../../lib/idle");

module.exports = {
  name: "deleteQueue",

  /**
   * DisTube deletes the queue whenever playback ends for any reason: the queue
   * ran out, somebody used /stop, or autoplay found nothing else to play. The
   * voice connection survives that, so this is the one place that needs to
   * start the idle timer.
   *
   * @param {import("distube").Queue} queue
   * @param {import("discord.js").Client} client
   */
  execute(queue, client) {
    scheduleLeaveOnFinish(client, queue);
  },
};
