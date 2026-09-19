"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { Collection } = require("discord.js");

const COMMANDS_DIR = path.join(__dirname, "..", "commands");

/**
 * Recursively collect every `.js` file under a directory.
 * @param {string} dir
 * @returns {string[]} Absolute file paths.
 */
function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

/**
 * Load every command module from `src/commands`.
 *
 * A command module must export `data` (a SlashCommandBuilder) and `execute`.
 * It may also export `autocomplete`. Anything else is reported and skipped,
 * so one malformed file cannot stop the bot from starting.
 *
 * @returns {Collection<string, {
 *   data: import("discord.js").SlashCommandBuilder,
 *   execute: Function,
 *   autocomplete?: Function,
 *   category: string,
 * }>}
 */
function loadCommands() {
  const commands = new Collection();

  for (const file of collectFiles(COMMANDS_DIR)) {
    let command;
    try {
      command = require(file);
    } catch (error) {
      console.error(`[commands] Failed to load ${path.relative(COMMANDS_DIR, file)}:`, error);
      continue;
    }

    if (!command?.data || typeof command.execute !== "function") {
      console.warn(
        `[commands] Skipping ${path.relative(COMMANDS_DIR, file)}: ` +
          'it must export "data" and "execute".',
      );
      continue;
    }

    // The folder a command lives in doubles as its category in /help.
    command.category = path.basename(path.dirname(file));
    commands.set(command.data.name, command);
  }

  return commands;
}

module.exports = { loadCommands, collectFiles };
