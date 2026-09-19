"use strict";

const { MessageFlags, PermissionsBitField } = require("discord.js");
const embeds = require("./embeds");

/**
 * Reply to an interaction with an error embed, whether or not it was already
 * deferred or replied to.
 *
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {string} message
 */
async function replyError(interaction, message) {
  const payload = { embeds: [embeds.error(message)] };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  }
}

/**
 * Run the checks every music command shares: the caller must be in a voice
 * channel the bot can actually use, and must not be trying to control the bot
 * from a different channel than the one it is playing in.
 *
 * On failure this replies to the interaction and returns `null`, so callers can
 * simply `if (!context) return;`.
 *
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {{ requireQueue?: boolean, requirePlaying?: boolean }} [options]
 * @returns {Promise<{
 *   voiceChannel: import("discord.js").VoiceBasedChannel,
 *   queue: import("distube").Queue | undefined,
 * } | null>}
 */
async function requireVoice(interaction, { requireQueue = false, requirePlaying = false } = {}) {
  const { distube } = interaction.client;
  const member = interaction.member;
  const voiceChannel = member?.voice?.channel ?? null;

  if (!voiceChannel) {
    await replyError(interaction, "Join a voice channel first.");
    return null;
  }

  const me = interaction.guild.members.me;
  const permissions = voiceChannel.permissionsFor(me);
  if (!permissions?.has(PermissionsBitField.Flags.ViewChannel)) {
    await replyError(interaction, `I cannot see ${voiceChannel}.`);
    return null;
  }
  if (!permissions.has(PermissionsBitField.Flags.Connect)) {
    await replyError(interaction, `I do not have permission to join ${voiceChannel}.`);
    return null;
  }
  if (!permissions.has(PermissionsBitField.Flags.Speak)) {
    await replyError(interaction, `I do not have permission to speak in ${voiceChannel}.`);
    return null;
  }

  // If the bot is already connected somewhere else, refuse to be hijacked.
  const botChannelId = me.voice?.channelId;
  if (botChannelId && botChannelId !== voiceChannel.id) {
    await replyError(interaction, `I am already playing in <#${botChannelId}>.`);
    return null;
  }

  const queue = distube.getQueue(interaction.guildId);
  if ((requireQueue || requirePlaying) && !queue) {
    await replyError(interaction, "There is nothing playing right now.");
    return null;
  }
  if (requirePlaying && !queue.songs.length) {
    await replyError(interaction, "There is nothing playing right now.");
    return null;
  }

  return { voiceChannel, queue };
}

module.exports = { requireVoice, replyError };
