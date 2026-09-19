"use strict";

const config = require("../config");
const embeds = require("./embeds");

/**
 * Pending auto-leave timers, keyed by guild id.
 * @type {Map<string, NodeJS.Timeout>}
 */
const timers = new Map();

/**
 * Cancel a pending auto-leave for a guild. Called whenever playback resumes.
 * @param {string} guildId
 */
function cancelLeave(guildId) {
  const timer = timers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(guildId);
  }
}

/**
 * Leave a guild's voice channel after a delay, unless something starts playing
 * again first.
 *
 * DisTube v5 removed the `leaveOnEmpty` / `leaveOnFinish` / `leaveOnStop`
 * options that older versions had, so this behaviour lives in the bot.
 *
 * @param {import("discord.js").Client} client
 * @param {string} guildId
 * @param {{ seconds: number, reason: string, channel?: import("discord.js").GuildTextBasedChannel }} options
 */
function scheduleLeave(client, guildId, { seconds, reason, channel }) {
  cancelLeave(guildId);
  if (seconds <= 0) return;

  const timer = setTimeout(async () => {
    timers.delete(guildId);
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild?.members.me?.voice?.channelId) return;

      // Something started playing again while we were waiting.
      const queue = client.distube.getQueue(guildId);
      if (queue?.songs.length) return;

      client.distube.voices.leave(guildId);

      if (channel?.isTextBased?.()) {
        const sendable = channel
          .permissionsFor(guild.members.me)
          ?.has(["ViewChannel", "SendMessages"]);
        if (sendable) {
          await channel.send({ embeds: [embeds.info(`👋 Left the voice channel ${reason}.`)] });
        }
      }
    } catch (error) {
      console.error(`[idle] Failed to leave voice in guild ${guildId}:`, error);
    }
  }, seconds * 1000);

  // Never keep the process alive just to run a leave timer.
  timer.unref?.();
  timers.set(guildId, timer);
}

/**
 * Schedule the "queue ran out" leave, using the configured cooldown.
 * @param {import("discord.js").Client} client
 * @param {import("distube").Queue} queue
 */
function scheduleLeaveOnFinish(client, queue) {
  scheduleLeave(client, queue.id, {
    seconds: config.leaveOnFinishCooldown,
    reason: "because the queue is empty",
    channel: queue.textChannel,
  });
}

module.exports = { scheduleLeave, scheduleLeaveOnFinish, cancelLeave };
