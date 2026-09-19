"use strict";

require("dotenv").config({ quiet: true });

/**
 * Read an environment variable that the bot cannot run without.
 * @param {string} key
 * @returns {string}
 */
function required(key) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable "${key}". ` +
        "Copy .env.example to .env and fill it in.",
    );
  }
  return value;
}

/**
 * Read an optional environment variable.
 * @param {string} key
 * @param {string} [fallback]
 * @returns {string | undefined}
 */
function optional(key, fallback) {
  const value = process.env[key]?.trim();
  return value || fallback;
}

/**
 * Read an environment variable that should hold a number.
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
function number(key, fallback) {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  /** Bot token from the Discord developer portal. */
  token: required("DISCORD_TOKEN"),
  /** Application (client) id, used when registering slash commands. */
  clientId: required("CLIENT_ID"),
  /**
   * Optional guild id. When set, slash commands are registered to that guild
   * only, which updates instantly and is ideal while developing. Leave it empty
   * to register the commands globally (Discord can take up to an hour to
   * propagate those).
   */
  guildId: optional("GUILD_ID"),

  /** Optional Spotify credentials, which raise the Spotify API rate limits. */
  spotify: {
    clientId: optional("SPOTIFY_CLIENT_ID"),
    clientSecret: optional("SPOTIFY_CLIENT_SECRET"),
  },

  /**
   * Prefix for classic text commands, such as `!play`. Leave it empty to run
   * slash commands only — which also means the bot no longer needs the
   * privileged Message Content intent.
   */
  // Set but empty (`PREFIX=`) means "disabled"; absent entirely means "use
  // the default", so this cannot go through optional().
  prefix: process.env.PREFIX === undefined ? "!" : process.env.PREFIX.trim(),

  /** Default playback volume (percent) for a freshly created queue. */
  defaultVolume: number("DEFAULT_VOLUME", 50),
  /** How long to stay in an empty voice channel before leaving, in seconds. */
  leaveOnEmptyCooldown: number("LEAVE_ON_EMPTY_COOLDOWN", 60),
  /** How long to stay after the queue finishes, in seconds. */
  leaveOnFinishCooldown: number("LEAVE_ON_FINISH_COOLDOWN", 60),
  /** Largest number of tracks taken from a single playlist URL. */
  maxPlaylistSize: number("MAX_PLAYLIST_SIZE", 100),
  /** Accent colour used by the bot's embeds. */
  embedColor: optional("EMBED_COLOR", "#5865F2"),
};
