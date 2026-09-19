"use strict";

const { Client, GatewayIntentBits } = require("discord.js");
const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { DeezerPlugin } = require("@distube/deezer");
const ffmpegPath = require("ffmpeg-static");

// Load the configuration first, and report a missing .env as a plain message
// rather than a stack trace.
let config;
try {
  config = require("./config");
} catch (error) {
  console.error(`\n✖ ${error.message}\n`);
  process.exit(1);
}

const { YtDlpPlugin } = require("./lib/ytdlpPlugin");
const { loadCommands } = require("./handlers/commandHandler");
const { loadEvents } = require("./handlers/eventHandler");

// Pull in the voice encryption backend up front so that a missing or broken
// install fails loudly here, rather than the first time somebody runs /play.
require("libsodium-wrappers");

const intents = [
  // Required for guild and slash-command data.
  GatewayIntentBits.Guilds,
  // Required by DisTube to track who is in a voice channel.
  GatewayIntentBits.GuildVoiceStates,
];

// Prefix commands need to read message text, and MessageContent is a
// privileged intent. Only ask for it when a prefix is actually configured, so
// a slash-only setup needs nothing enabled in the Developer Portal.
if (config.prefix) {
  intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
}

const client = new Client({ intents });

/**
 * Slash commands, keyed by command name. Populated before login so the
 * interaction handler never races against the loader.
 */
client.commands = loadCommands();

client.distube = new DisTube(client, {
  // Order matters. Spotify and Deezer only resolve metadata, then hand a
  // search query back to an extractor plugin; the yt-dlp plugin below accepts
  // every URL, so it has to come last or it would swallow the others.
  plugins: [
    new SpotifyPlugin({
      api: {
        clientId: config.spotify.clientId,
        clientSecret: config.spotify.clientSecret,
      },
    }),
    new DeezerPlugin(),
    new YtDlpPlugin({ maxPlaylistSize: config.maxPlaylistSize }),
  ],
  // Don't re-announce the same track when a song or the queue is on repeat.
  emitNewSongOnly: true,
  // Needed for /previous, and it gives autoplay a history to avoid repeating.
  savePreviousSongs: true,
  // The first song of a new queue is announced by "Now playing" a moment
  // later, so skip the redundant "Added ..." message for it. Playlists still
  // announce themselves, since "Now playing" only names the first track.
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: true,
  // Use the ffmpeg binary that ships with ffmpeg-static, so the bot does not
  // depend on ffmpeg being installed system-wide.
  ffmpeg: { path: ffmpegPath },
});

loadEvents(client, client.distube);

/**
 * Close the gateway connection and any voice connections before exiting, so
 * the bot does not linger in voice channels after a restart.
 * @param {string} signal
 */
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n[bot] Received ${signal}, shutting down...`);
  try {
    // Snapshot first: stopping a queue removes it from the collection.
    for (const queue of [...client.distube.queues.collection.values()]) {
      await queue.stop().catch(() => {});
    }
    await client.destroy();
  } catch (error) {
    console.error("[bot] Error during shutdown:", error);
  } finally {
    // Let the process end once its handles close, rather than calling
    // process.exit() out from under them. The timer is a backstop for a
    // connection that refuses to close, and is unref'd so it never keeps the
    // process alive by itself.
    process.exitCode = 0;
    setTimeout(() => process.exit(0), 3000).unref();
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// A music bot spends its life talking to flaky external services. Log these
// rather than letting one bad response kill the process.
process.on("unhandledRejection", (reason) => {
  console.error("[bot] Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[bot] Uncaught exception:", error);
});

client.login(config.token).catch(async (error) => {
  if (error?.code === "TokenInvalid") {
    console.error("\n✖ Discord rejected the bot token.");
    console.error("  Check DISCORD_TOKEN in your .env file. If in doubt, reset the token at");
    console.error("  https://discord.com/developers/applications -> your app -> Bot.\n");
  } else if (error?.code === "DisallowedIntents") {
    console.error("\n✖ Discord refused the requested gateway intents.");
    console.error("  Prefix commands need the MESSAGE CONTENT INTENT. Enable it at");
    console.error("  https://discord.com/developers/applications -> your app -> Bot,");
    console.error('  or set PREFIX= (empty) in .env to use slash commands only.\n');
  } else {
    console.error("\n✖ Failed to log in:", error?.message ?? error, "\n");
  }

  // Shut the client down and let the process end on its own. Calling
  // process.exit() here would tear down libuv handles that discord.js is
  // still closing, which trips an assertion on Windows.
  process.exitCode = 1;
  await client.destroy().catch(() => {});
});
