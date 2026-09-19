"use strict";

const embeds = require("../../lib/embeds");
const { safeSend } = require("../../lib/send");
const { truncate } = require("../../lib/format");

module.exports = {
  name: "error",

  /**
   * DisTube v5 emits `error` as `(error, queue, song)` — the error comes
   * first, unlike v4 where the text channel did.
   *
   * Note that an `error` event with no listener would be rethrown by Node and
   * crash the process, so this handler must exist even if it only logged.
   *
   * @param {Error} error
   * @param {import("distube").Queue} [queue]
   * @param {import("distube").Song} [song]
   */
  async execute(error, queue, song) {
    const context = song?.name ? ` while playing "${song.name}"` : "";
    console.error(`[player] Error in guild ${queue?.id ?? "unknown"}${context}:`, error);

    const detail = truncate(String(error?.message ?? error), 300);
    await safeSend(queue?.textChannel, {
      embeds: [embeds.error(`Playback error${context}:\n\`\`\`\n${detail}\n\`\`\``)],
    });
  },
};
