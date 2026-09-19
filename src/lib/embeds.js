"use strict";

const { EmbedBuilder } = require("discord.js");
const config = require("../config");

const SUCCESS_COLOR = 0x57f287;
const ERROR_COLOR = 0xed4245;
const WARNING_COLOR = 0xfee75c;

/** A plain embed in the bot's accent colour. */
function info(description, title) {
  const embed = new EmbedBuilder().setColor(config.embedColor).setDescription(description);
  if (title) embed.setTitle(title);
  return embed;
}

/** A green embed, for "that worked" replies. */
function success(description) {
  return new EmbedBuilder().setColor(SUCCESS_COLOR).setDescription(`✅ ${description}`);
}

/** A red embed, for user mistakes and failures. */
function error(description) {
  return new EmbedBuilder().setColor(ERROR_COLOR).setDescription(`❌ ${description}`);
}

/** A yellow embed, for "nothing happened, and here is why" replies. */
function warning(description) {
  return new EmbedBuilder().setColor(WARNING_COLOR).setDescription(`⚠️ ${description}`);
}

module.exports = { info, success, error, warning };
