"use strict";

/**
 * DisTube runs ffmpeg with stdout piped to the voice connection and stderr
 * captured, then forwards both the spawn command line and every stderr line
 * through `ffmpegDebug`. Nothing listens to that event by default, so a stream
 * that ends the instant it starts — "Now playing" immediately followed by
 * "Queue finished" — leaves no trace at all: ffmpeg exits 0, no `error` event
 * is emitted, and the queue simply advances.
 *
 * This is the only place ffmpeg's side of the story is visible, so it is worth
 * a listener. It is off unless DEBUG_FFMPEG is set, because it logs the full
 * command line (including the signed stream URL) and every line ffmpeg writes.
 */

const ENABLED = Boolean(process.env.DEBUG_FFMPEG?.trim());

module.exports = {
  name: "ffmpegDebug",

  /**
   * @param {string} message
   */
  execute(message) {
    if (!ENABLED) return;
    console.log(`[ffmpeg] ${message}`);
  },
};
