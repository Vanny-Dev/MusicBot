"use strict";

const path = require("node:path");
const { collectFiles } = require("./commandHandler");

const EVENTS_DIR = path.join(__dirname, "..", "events");

/**
 * Load one directory of event modules and bind them to an emitter.
 *
 * Each module exports `name` (the event name), an optional `once` flag, and
 * `execute(...args, client)`. The client is appended as the last argument so
 * every handler can reach `client.distube` without extra wiring.
 *
 * @param {string} dir Directory to read.
 * @param {import("node:events").EventEmitter} emitter Emitter to bind to.
 * @param {import("discord.js").Client} client
 * @param {string} label Used in log output.
 * @returns {number} How many handlers were registered.
 */
function bindEvents(dir, emitter, client, label) {
  let count = 0;

  for (const file of collectFiles(dir)) {
    let event;
    try {
      event = require(file);
    } catch (error) {
      console.error(`[events] Failed to load ${path.basename(file)}:`, error);
      continue;
    }

    if (!event?.name || typeof event.execute !== "function") {
      console.warn(
        `[events] Skipping ${path.basename(file)}: it must export "name" and "execute".`,
      );
      continue;
    }

    // Wrapping every handler means a rejected promise inside one of them is
    // logged instead of surfacing as an unhandled rejection.
    const listener = async (...args) => {
      try {
        await event.execute(...args, client);
      } catch (error) {
        console.error(`[${label}] Error in "${event.name}" handler:`, error);
      }
    };

    if (event.once) emitter.once(event.name, listener);
    else emitter.on(event.name, listener);
    count += 1;
  }

  return count;
}

/**
 * Register every client event (`src/events/client`) and every DisTube event
 * (`src/events/player`).
 *
 * @param {import("discord.js").Client} client
 * @param {import("distube").DisTube} distube
 */
function loadEvents(client, distube) {
  const clientEvents = bindEvents(path.join(EVENTS_DIR, "client"), client, client, "client");
  const playerEvents = bindEvents(path.join(EVENTS_DIR, "player"), distube, client, "player");
  console.log(`[events] Registered ${clientEvents} client and ${playerEvents} player events.`);
}

module.exports = { loadEvents };
