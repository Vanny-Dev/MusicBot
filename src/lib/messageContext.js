"use strict";

const { ApplicationCommandOptionType } = require("discord.js");

/**
 * Thrown when a message command was typed wrongly (a missing argument, a bad
 * number, an unknown choice). The message is shown to the user along with the
 * command's usage line, so keep it short and readable.
 */
class UsageError extends Error {}

/** Words accepted for boolean options. */
const TRUE_WORDS = new Set(["true", "yes", "y", "on", "1"]);
const FALSE_WORDS = new Set(["false", "no", "n", "off", "0"]);

/**
 * Split an argument string into tokens, honouring "quoted phrases".
 * @param {string} input
 * @returns {string[]}
 */
function tokenize(input) {
  const tokens = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = pattern.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

/**
 * Build the usage line shown when a command is typed wrongly.
 * @param {string} prefix
 * @param {object} json A slash command's `toJSON()` output.
 * @returns {string}
 */
function usageFor(prefix, json) {
  const parts = (json.options ?? []).map((option) => {
    if (option.type === ApplicationCommandOptionType.Boolean) return `[--${option.name}]`;
    return option.required ? `<${option.name}>` : `[${option.name}]`;
  });
  return `${prefix}${json.name}${parts.length ? ` ${parts.join(" ")}` : ""}`;
}

/** Coerce one raw token into the type a slash command option declares. */
function coerce(option, raw) {
  switch (option.type) {
    case ApplicationCommandOptionType.Integer:
    case ApplicationCommandOptionType.Number: {
      const value =
        option.type === ApplicationCommandOptionType.Integer
          ? Number.parseInt(raw, 10)
          : Number(raw);
      if (!Number.isFinite(value) || (option.type === 4 && !/^-?\d+$/.test(raw.trim()))) {
        throw new UsageError(`\`${option.name}\` must be a number, but got \`${raw}\`.`);
      }
      if (option.min_value !== undefined && value < option.min_value) {
        throw new UsageError(`\`${option.name}\` must be at least ${option.min_value}.`);
      }
      if (option.max_value !== undefined && value > option.max_value) {
        throw new UsageError(`\`${option.name}\` must be at most ${option.max_value}.`);
      }
      return value;
    }

    case ApplicationCommandOptionType.Boolean: {
      const word = raw.toLowerCase();
      if (TRUE_WORDS.has(word)) return true;
      if (FALSE_WORDS.has(word)) return false;
      throw new UsageError(`\`${option.name}\` must be yes or no, but got \`${raw}\`.`);
    }

    default: {
      if (option.choices?.length) {
        const match = option.choices.find(
          (choice) => String(choice.value).toLowerCase() === raw.toLowerCase(),
        );
        if (!match) {
          const allowed = option.choices.map((c) => `\`${c.value}\``).join(", ");
          throw new UsageError(`\`${option.name}\` must be one of: ${allowed}.`);
        }
        return match.value;
      }
      return raw;
    }
  }
}

/**
 * Turn the text after a command name into the option values that command
 * expects.
 *
 * Two forms are accepted, and they can be mixed:
 *
 * - **Flags** anywhere in the line: `--next`, `--requeue=no`. Useful for the
 *   optional booleans, which have no obvious position.
 * - **Positional** arguments in declaration order: `!volume 80`, `!jump 3`.
 *
 * A free-text string option (one with no fixed choices, such as `/play`'s
 * query) swallows all remaining tokens, so quoting a search term is optional.
 *
 * @param {object} json A slash command's `toJSON()` output.
 * @param {string} argString Everything after the command name.
 * @returns {Map<string, string | number | boolean>}
 */
function parseArgs(json, argString) {
  const options = json.options ?? [];
  const values = new Map();
  const byName = new Map(options.map((option) => [option.name, option]));

  // Pass 1: pull out --flags, wherever they appear.
  const positional = [];
  for (const token of tokenize(argString)) {
    const flag = /^--([\w-]+)(?:=(.*))?$/.exec(token);
    const option = flag ? byName.get(flag[1].toLowerCase()) : null;
    if (!option) {
      positional.push(token);
      continue;
    }
    // A bare --flag on a boolean option means "true".
    const raw =
      flag[2] ?? (option.type === ApplicationCommandOptionType.Boolean ? "true" : null);
    if (raw === null) {
      throw new UsageError(`\`--${option.name}\` needs a value, like \`--${option.name}=…\`.`);
    }
    values.set(option.name, coerce(option, raw));
  }

  // Pass 2: assign what is left, in the order the options were declared.
  let cursor = 0;
  for (const option of options) {
    if (values.has(option.name)) continue;
    if (cursor >= positional.length) continue;

    const isFreeText =
      option.type === ApplicationCommandOptionType.String && !option.choices?.length;

    if (isFreeText) {
      // Free text runs to the end of the line, so `!play daft punk` works
      // without quotes.
      values.set(option.name, positional.slice(cursor).join(" "));
      cursor = positional.length;
    } else {
      values.set(option.name, coerce(option, positional[cursor]));
      cursor += 1;
    }
  }

  return values;
}

/**
 * Stands in for `interaction.options`, exposing the same getters the command
 * files already call.
 */
class MessageCommandOptions {
  /**
   * @param {Map<string, string | number | boolean>} values
   */
  constructor(values) {
    this.values = values;
  }

  /** @param {string} name @param {boolean} [required] */
  #get(name, required) {
    const value = this.values.get(name);
    if (value === undefined) {
      if (required) throw new UsageError(`\`${name}\` is required.`);
      return null;
    }
    return value;
  }

  getString(name, required = false) {
    const value = this.#get(name, required);
    return value === null ? null : String(value);
  }

  getInteger(name, required = false) {
    const value = this.#get(name, required);
    return value === null ? null : Number(value);
  }

  getNumber(name, required = false) {
    return this.getInteger(name, required);
  }

  getBoolean(name, required = false) {
    const value = this.#get(name, required);
    return value === null ? null : Boolean(value);
  }

  getSubcommand() {
    return null;
  }
}

/**
 * Wraps a {@link Message} so that a command written against
 * `ChatInputCommandInteraction` runs unchanged.
 *
 * It mirrors the small slice of the interaction API the commands actually use:
 * `deferReply`, `reply`, `editReply`, `deleteReply`, the `deferred` / `replied`
 * flags, and `options`. Interaction-only bits are translated rather than
 * faked — `deferReply` starts a typing indicator, and the ephemeral flag is
 * dropped because a normal message cannot be ephemeral.
 */
class MessageCommandContext {
  /**
   * @param {import("discord.js").Message} message
   * @param {string} commandName
   * @param {MessageCommandOptions} options
   */
  constructor(message, commandName, options) {
    this.message = message;
    this.commandName = commandName;
    this.options = options;

    this.client = message.client;
    this.guild = message.guild;
    this.guildId = message.guildId;
    this.channel = message.channel;
    this.member = message.member;
    this.user = message.author;
    this.createdTimestamp = message.createdTimestamp;

    this.deferred = false;
    this.replied = false;
    /** Marks this as a message command, for anything that needs to care. */
    this.isMessageCommand = true;

    /** @type {import("discord.js").Message | null} */
    this.sent = null;
  }

  inGuild() {
    return Boolean(this.message.guildId);
  }

  isChatInputCommand() {
    return false;
  }

  /**
   * Strip interaction-only fields that `channel.send` would reject, and stop
   * replies from pinging the author.
   */
  static #clean(payload) {
    const { flags, ephemeral, withResponse, fetchReply, ...rest } =
      typeof payload === "string" ? { content: payload } : payload;
    return { ...rest, allowedMentions: { repliedUser: false, parse: [] } };
  }

  /** Show a typing indicator; the real reply arrives via `editReply`. */
  async deferReply() {
    this.deferred = true;
    await this.channel.sendTyping().catch(() => {});
    // Shaped like an InteractionCallbackResponse so `withResponse` callers
    // can read through it and fall back cleanly.
    return { resource: { message: null } };
  }

  async reply(payload) {
    this.sent = await this.message.reply(MessageCommandContext.#clean(payload));
    this.replied = true;
    this.deferred = false;
    return this.sent;
  }

  async editReply(payload) {
    if (!this.sent) return this.reply(payload);
    this.sent = await this.sent.edit(MessageCommandContext.#clean(payload));
    return this.sent;
  }

  async followUp(payload) {
    return this.channel.send(MessageCommandContext.#clean(payload));
  }

  async deleteReply() {
    if (!this.sent) return;
    await this.sent.delete().catch(() => {});
    this.sent = null;
    this.replied = false;
  }

  async fetchReply() {
    return this.sent;
  }
}

module.exports = {
  MessageCommandContext,
  MessageCommandOptions,
  UsageError,
  parseArgs,
  tokenize,
  usageFor,
};
