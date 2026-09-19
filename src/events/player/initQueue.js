"use strict";

const config = require("../../config");

module.exports = {
  name: "initQueue",

  /**
   * Apply the bot's defaults to every newly created queue.
   *
   * @param {import("distube").Queue} queue
   */
  execute(queue) {
    queue.setVolume(config.defaultVolume);
  },
};
