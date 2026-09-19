"use strict";

const { PermissionsBitField } = require("discord.js");

/**
 * Send a message to a channel, but only if the bot is actually allowed to.
 *
 * Player events fire long after the command that started them, by which point
 * the channel may have been deleted or the bot's permissions changed. Throwing
 * there would be noise, so failures are swallowed deliberately.
 *
 * @param {import("discord.js").GuildTextBasedChannel | undefined} channel
 * @param {import("discord.js").MessagePayload | object} payload
 * @returns {Promise<import("discord.js").Message | null>}
 */
async function safeSend(channel, payload) {
  try {
    if (!channel?.isTextBased?.()) return null;

    const me = channel.guild?.members?.me;
    if (!me) return null;

    const permissions = channel.permissionsFor(me);
    const required = [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.EmbedLinks,
    ];
    if (!permissions?.has(required)) return null;

    return await channel.send(payload);
  } catch {
    return null;
  }
}

module.exports = { safeSend };
