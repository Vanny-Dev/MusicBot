"use strict";

const { Events } = require("discord.js");
const { isVoiceChannelEmpty } = require("distube");

const config = require("../../config");
const { scheduleLeave, cancelLeave } = require("../../lib/idle");

module.exports = {
  name: Events.VoiceStateUpdate,

  /**
   * Leave a voice channel once everybody else has left it, and pause the
   * pending leave if somebody comes back.
   *
   * DisTube v5 dropped the old `leaveOnEmpty` option, so the bot owns this.
   *
   * @param {import("discord.js").VoiceState} oldState
   * @param {import("discord.js").VoiceState} newState
   * @param {import("discord.js").Client} client
   */
  async execute(oldState, newState, client) {
    const guild = newState.guild ?? oldState.guild;
    const me = guild.members.me;
    const botChannelId = me?.voice?.channelId;

    // The bot is not connected here, so there is nothing to time out.
    if (!botChannelId) {
      cancelLeave(guild.id);
      return;
    }

    // Ignore activity in channels the bot is not sitting in.
    if (oldState.channelId !== botChannelId && newState.channelId !== botChannelId) return;

    if (isVoiceChannelEmpty(newState)) {
      const queue = client.distube.getQueue(guild.id);
      scheduleLeave(client, guild.id, {
        seconds: config.leaveOnEmptyCooldown,
        reason: "because everyone left",
        channel: queue?.textChannel,
      });
      return;
    }

    // Somebody is listening again. Only call off a leave that was scheduled
    // because the channel was empty; a finished queue still times out.
    const queue = client.distube.getQueue(guild.id);
    if (queue?.songs.length) cancelLeave(guild.id);
  },
};
