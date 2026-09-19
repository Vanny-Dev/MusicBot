"use strict";

const { Events, PermissionsBitField } = require("discord.js");

const config = require("../../config");
const embeds = require("../../lib/embeds");
const {
  MessageCommandContext,
  MessageCommandOptions,
  UsageError,
  parseArgs,
  usageFor,
} = require("../../lib/messageContext");

module.exports = {
  name: Events.MessageCreate,

  /**
   * Run prefix commands such as `!play daft punk`.
   *
   * The message is adapted into something shaped like a slash command
   * interaction, so every command in `src/commands` works from both entry
   * points with no changes of its own.
   *
   * @param {import("discord.js").Message} message
   * @param {import("discord.js").Client} client
   */
  async execute(message, client) {
    const prefix = config.prefix;
    if (!prefix) return;

    if (message.author.bot || message.system) return;
    if (!message.inGuild()) return;
    if (!message.content.startsWith(prefix)) return;

    const withoutPrefix = message.content.slice(prefix.length).trimStart();
    const spaceIndex = withoutPrefix.search(/\s/);
    const name = (spaceIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, spaceIndex))
      .toLowerCase();
    const argString = spaceIndex === -1 ? "" : withoutPrefix.slice(spaceIndex + 1).trim();

    if (!name) return;

    const command = client.commands.get(name) ?? findByAlias(client, name);
    if (!command) return;

    // Without permission to reply there is no way to report anything, so stop
    // before doing any work.
    const permissions = message.channel.permissionsFor(message.guild.members.me);
    if (
      !permissions?.has([
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.EmbedLinks,
      ])
    ) {
      return;
    }

    const json = command.data.toJSON();

    let context;
    try {
      context = new MessageCommandContext(
        message,
        json.name,
        new MessageCommandOptions(parseArgs(json, argString)),
      );
      await command.execute(context, client);
    } catch (error) {
      if (error instanceof UsageError) {
        await message
          .reply({
            embeds: [
              embeds.error(`${error.message}\n\nUsage: \`${usageFor(prefix, json)}\``),
            ],
            allowedMentions: { repliedUser: false, parse: [] },
          })
          .catch(() => {});
        return;
      }

      console.error(`[commands] Error running ${prefix}${name}:`, error);
      const payload = {
        embeds: [embeds.error("Something went wrong while running that command.")],
      };
      try {
        if (context?.sent) await context.editReply(payload);
        else await message.reply({ ...payload, allowedMentions: { repliedUser: false, parse: [] } });
      } catch {
        // Nothing more we can do; the log above is the record.
      }
    }
  },
};

/**
 * Resolve a shorthand such as `np` or `q` to a command.
 * @param {import("discord.js").Client} client
 * @param {string} name
 */
function findByAlias(client, name) {
  const aliases = {
    p: "play",
    q: "queue",
    np: "nowplaying",
    s: "skip",
    next: "skip",
    vol: "volume",
    v: "volume",
    disconnect: "leave",
    dc: "leave",
    repeat: "loop",
    back: "previous",
    prev: "previous",
    h: "help",
    commands: "help",
  };
  const target = aliases[name];
  return target ? client.commands.get(target) : undefined;
}
