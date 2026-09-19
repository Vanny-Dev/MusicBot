"use strict";

const { cancelLeave } = require("../../lib/idle");

module.exports = {
  name: "disconnect",

  /**
   * @param {import("distube").Queue} queue
   */
  execute(queue) {
    // The bot is out of voice already, so drop any pending leave timer.
    cancelLeave(queue.id);
  },
};
