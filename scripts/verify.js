"use strict";

/**
 * Offline health check for the bot's setup.
 *
 *     npm run verify
 *
 * It loads every command and event, validates the slash-command payloads
 * against Discord's rules, builds the real DisTube instance, and confirms the
 * plugin order. It never touches the network or logs in, so it is safe to run
 * before you have a token.
 */

// The config module requires these, but nothing here actually logs in.
process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN || "verify.placeholder.token";
process.env.CLIENT_ID = process.env.CLIENT_ID || "123456789012345678";

const path = require("node:path");
const { Client, GatewayIntentBits } = require("discord.js");
const { DisTube, Events: DisTubeEvents } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { DeezerPlugin } = require("@distube/deezer");
const ffmpegPath = require("ffmpeg-static");

const config = require("../src/config");
const { YtDlpPlugin } = require("../src/lib/ytdlpPlugin");
const { loadCommands, collectFiles } = require("../src/handlers/commandHandler");
const { loadEvents } = require("../src/handlers/eventHandler");

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error("  ✗ " + msg);
};
const pass = (msg) => console.log("  ✓ " + msg);

console.log("\n== 1. commands ==");
const commands = loadCommands();
console.log(`  loaded ${commands.size} commands`);
const names = new Set();
for (const [name, command] of commands) {
  try {
    const json = command.data.toJSON();
    if (json.name !== name) fail(`${name}: builder name mismatch (${json.name})`);
    if (names.has(json.name)) fail(`duplicate command name ${json.name}`);
    names.add(json.name);
    if (!json.description || json.description.length > 100) {
      fail(`${name}: bad description length`);
    }
    if (!/^[-_\p{L}\p{N}]{1,32}$/u.test(json.name) || json.name !== json.name.toLowerCase()) {
      fail(`${name}: invalid command name`);
    }
    for (const opt of json.options ?? []) {
      if (!opt.description || opt.description.length > 100) {
        fail(`${name}.${opt.name}: bad option description`);
      }
      if ((opt.choices ?? []).length > 25) fail(`${name}.${opt.name}: too many choices`);
    }
    // Required options must come before optional ones, or Discord rejects
    // the whole command.
    let seenOptional = false;
    for (const o of json.options ?? []) {
      if (!o.required) seenOptional = true;
      else if (seenOptional) fail(`${name}: required option "${o.name}" after an optional one`);
    }
    pass(`/${json.name} (${(json.options ?? []).length} option(s))`);
  } catch (error) {
    fail(`${name}: toJSON() threw: ${error.message}`);
  }
}

console.log("\n== 2. autocomplete wiring ==");
for (const [name, command] of commands) {
  const hasAuto = (command.data.toJSON().options ?? []).some((o) => o.autocomplete);
  if (hasAuto && typeof command.autocomplete !== "function") {
    fail(`/${name} declares autocomplete but exports no autocomplete()`);
  } else if (hasAuto) {
    pass(`/${name} has an autocomplete handler`);
  }
}

console.log("\n== 3. distube construction ==");
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
client.commands = commands;
let distube;
try {
  distube = new DisTube(client, {
    plugins: [
      new SpotifyPlugin({
        api: { clientId: config.spotify.clientId, clientSecret: config.spotify.clientSecret },
      }),
      new DeezerPlugin(),
      new YtDlpPlugin({ maxPlaylistSize: config.maxPlaylistSize }),
    ],
    emitNewSongOnly: true,
    savePreviousSongs: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: true,
    ffmpeg: { path: ffmpegPath },
  });
  client.distube = distube;
  pass(`DisTube v${require("distube").version} constructed with ${distube.plugins.length} plugins`);
  pass(`plugin order: ${distube.plugins.map((p) => `${p.constructor.name}(${p.type})`).join(" -> ")}`);

  const last = distube.plugins[distube.plugins.length - 1];
  if (!(last instanceof YtDlpPlugin)) fail("YtDlpPlugin must be registered last (it matches every URL)");
  else pass("catch-all YtDlpPlugin is last");

  if (!distube.plugins.some((p) => p.type === "extractor")) {
    fail("no extractor plugin: plain-text searches would fail");
  } else pass("an extractor plugin is present, so text search works");
} catch (error) {
  fail(`DisTube construction threw: ${error.message}`);
}

console.log("\n== 4. events ==");
const validDistubeEvents = new Set(Object.values(DisTubeEvents));
for (const file of collectFiles(path.join(__dirname, "..", "src", "events", "player"))) {
  const mod = require(file);
  if (!validDistubeEvents.has(mod.name)) {
    fail(`${path.basename(file)}: "${mod.name}" is not a DisTube v5 event`);
  } else pass(`player event "${mod.name}"`);
}
const { Events } = require("discord.js");
const validClientEvents = new Set(Object.values(Events));
for (const file of collectFiles(path.join(__dirname, "..", "src", "events", "client"))) {
  const mod = require(file);
  if (!validClientEvents.has(mod.name)) {
    fail(`${path.basename(file)}: "${mod.name}" is not a discord.js event`);
  } else pass(`client event "${mod.name}"`);
}

if (distube) {
  loadEvents(client, distube);
  for (const ev of ["error", "playSong", "addSong", "finish", "deleteQueue"]) {
    if (distube.listenerCount(ev) < 1) fail(`no listener bound for DisTube "${ev}"`);
  }
  pass("all handlers bound to the live emitters");
}

console.log("\n== 5. formatting helpers ==");
const { formatDuration, parseDuration, progressBar } = require("../src/lib/format");
const cases = [
  [formatDuration(0), "0:00"],
  [formatDuration(59), "0:59"],
  [formatDuration(213), "3:33"],
  [formatDuration(3661), "1:01:01"],
  [String(parseDuration("90")), "90"],
  [String(parseDuration("1:30")), "90"],
  [String(parseDuration("1:02:03")), "3723"],
  [String(parseDuration("abc")), "null"],
  [String(parseDuration("")), "null"],
  [String([...progressBar(0, 0)].length), "18"],
  [String([...progressBar(50, 100)].length), "18"],
  [String([...progressBar(100, 100)].length), "18"],
  [String([...progressBar(-5, 100)].length), "18"],
];
for (const [got, want] of cases) {
  if (got !== want) fail(`expected "${want}", got "${got}"`);
}
pass(`${cases.length} formatting assertions`);

console.log("\n== 6. prefix command parsing ==");
const {
  MessageCommandContext,
  MessageCommandOptions,
  UsageError,
  parseArgs,
  usageFor,
} = require("../src/lib/messageContext");

const jsonOf = (name) => commands.get(name).data.toJSON();

/** Parse `args` for a command and return the resulting option values. */
const parsed = (name, args) => Object.fromEntries(parseArgs(jsonOf(name), args));

const parseCases = [
  ["play", "daft punk one more time", { query: "daft punk one more time" }],
  ["play", "https://youtu.be/dQw4w9WgXcQ", { query: "https://youtu.be/dQw4w9WgXcQ" }],
  ["play", "daft punk --next", { query: "daft punk", next: true }],
  ["play", '"quoted song title"', { query: "quoted song title" }],
  ["volume", "80", { percent: 80 }],
  ["volume", "", {}],
  ["queue", "2", { page: 2 }],
  ["loop", "song", { mode: "song" }],
  ["loop", "QUEUE", { mode: "queue" }],
  ["seek", "1:30", { position: "1:30" }],
  ["jump", "3 --requeue", { position: 3, requeue: true }],
  ["jump", "3 yes", { position: 3, requeue: true }],
  ["jump", "3 --requeue=no", { position: 3, requeue: false }],
  ["remove", "2", { position: 2 }],
  ["filter", "bassboost", { name: "bassboost" }],
];
for (const [name, args, want] of parseCases) {
  let got;
  try {
    got = parsed(name, args);
  } catch (error) {
    fail(`${name} "${args}" threw: ${error.message}`);
    continue;
  }
  // Compare by key, not by insertion order: flags are parsed before
  // positional arguments, so the order in the Map is not meaningful.
  const stable = (o) =>
    JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
  if (stable(got) !== stable(want)) {
    fail(`${name} "${args}" -> ${stable(got)}, expected ${stable(want)}`);
  }
}
pass(`${parseCases.length} argument-parsing cases`);

// Bad input must raise UsageError (a friendly message), never a raw crash.
const badCases = [
  ["volume", "abc"],
  ["volume", "999"],
  ["queue", "0"],
  ["loop", "bogus"],
  ["filter", "notafilter"],
  ["jump", "maybe"],
];
for (const [name, args] of badCases) {
  try {
    parseArgs(jsonOf(name), args);
    fail(`${name} "${args}" should have been rejected`);
  } catch (error) {
    if (!(error instanceof UsageError)) {
      fail(`${name} "${args}" threw ${error.constructor.name}, expected UsageError`);
    }
  }
}
pass(`${badCases.length} invalid-input cases rejected with a usage message`);

// Required options missing -> UsageError from the getter, as the handler expects.
for (const [name, optName] of [["play", "query"], ["loop", "mode"], ["seek", "position"]]) {
  const opts = new MessageCommandOptions(parseArgs(jsonOf(name), ""));
  try {
    if (jsonOf(name).options.find((o) => o.name === optName).type === 4) {
      opts.getInteger(optName, true);
    } else {
      opts.getString(optName, true);
    }
    fail(`${name}: missing required "${optName}" was not reported`);
  } catch (error) {
    if (!(error instanceof UsageError)) fail(`${name}: wrong error type for "${optName}"`);
  }
}
pass("missing required arguments are reported");

for (const [name, want] of [
  ["play", "!play <query> [--next]"],
  ["volume", "!volume [percent]"],
  ["jump", "!jump <position> [--requeue]"],
]) {
  const got = usageFor("!", jsonOf(name));
  if (got !== want) fail(`usage for ${name}: got "${got}", expected "${want}"`);
}
pass("usage lines render correctly");

console.log("\n== 7. message/interaction adapter ==");
// Run a real command through the adapter with a stubbed Message, proving the
// command files work unchanged from the prefix entry point.
let sentPayload = null;
const fakeSent = {
  edit: async (p) => {
    sentPayload = p;
    return fakeSent;
  },
  delete: async () => {},
};
const fakeMessage = {
  client,
  guild: { name: "Test Guild", members: { me: {} } },
  guildId: "1",
  guildID: "1",
  channel: { sendTyping: async () => {}, send: async () => fakeSent },
  member: {},
  author: { bot: false, username: "tester" },
  createdTimestamp: Date.now(),
  inGuild: () => true,
  reply: async (payload) => {
    sentPayload = payload;
    return fakeSent;
  },
};

const helpJson = jsonOf("help");
const ctx = new MessageCommandContext(
  fakeMessage,
  "help",
  new MessageCommandOptions(parseArgs(helpJson, "")),
);

(async () => {
  await commands.get("help").execute(ctx, client);

  if (!sentPayload?.embeds?.length) fail("adapter: /help sent no embed");
  else {
    const embed = sentPayload.embeds[0].toJSON();
    if (!embed.description?.includes("!")) fail("adapter: help does not mention the prefix");
    if (!embed.fields?.length) fail("adapter: help embed has no command fields");
    else pass(`adapter ran /help and produced ${embed.fields.length} field(s)`);
  }

  if (sentPayload?.allowedMentions?.repliedUser !== false) {
    fail("adapter: replies should not ping the author");
  } else pass("adapter suppresses reply pings");

  // deferReply must not throw and must flip the deferred flag.
  const ctx2 = new MessageCommandContext(fakeMessage, "ping", new MessageCommandOptions(new Map()));
  const deferred = await ctx2.deferReply({ withResponse: true });
  if (!ctx2.deferred) fail("adapter: deferReply did not set deferred");
  if (deferred?.resource === undefined) fail("adapter: deferReply return shape is wrong");
  else pass("adapter deferReply matches the withResponse shape");

  // Ephemeral flags are meaningless for messages and must be stripped.
  const { MessageFlags } = require("discord.js");
  await ctx2.reply({ content: "x", flags: MessageFlags.Ephemeral });
  if (sentPayload.flags !== undefined) fail("adapter: ephemeral flag was not stripped");
  else pass("adapter strips interaction-only fields");

  console.log(
    failures === 0 ? "\n✅ ALL CHECKS PASSED\n" : `\n❌ ${failures} CHECK(S) FAILED\n`,
  );
  client.destroy();
  process.exit(failures === 0 ? 0 : 1);
})();
