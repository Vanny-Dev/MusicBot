# Discord Music Bot

A Discord music bot built on [discord.js v14](https://discord.js.org) and
[DisTube v5](https://distube.js.org), with slash commands, search autocomplete,
queue control, audio filters and autoplay. Every command also works with a text
prefix, so `/play daft punk` and `!play daft punk` do the same thing.

Audio comes from `yt-dlp`, so anything yt-dlp supports plays: YouTube,
SoundCloud, Bandcamp, Twitch, Vimeo, direct media links and
[a thousand other sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).
Spotify and Deezer links are resolved to their track metadata and then matched
on YouTube, since neither service allows direct streaming.

## Requirements

- **Node.js 18.17 or newer** (tested on Node 26)
- No system-wide `ffmpeg` or `yt-dlp` install — both binaries are downloaded by
  `npm install`

## Setup

### 1. Install dependencies

```bash
npm install
```

> **npm 11 note:** npm now blocks package install scripts by default. Two
> packages here need theirs, because that is how they fetch their binaries
> (`ffmpeg-static` fetches ffmpeg, `@distube/yt-dlp` fetches yt-dlp). They are
> pre-approved in `package.json` under `allowScripts`. If you ever see
> `npm warn allow-scripts`, run:
>
> ```bash
> npm approve-scripts ffmpeg-static @distube/yt-dlp
> ```

### 2. Create the application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications)
   and create an application.
2. Under **Bot**, click *Reset Token* and copy the token.
3. Copy the **Application ID** from *General Information*.
4. Invite the bot with the `bot` and `applications.commands` scopes, and the
   *Connect*, *Speak*, *Send Messages*, *Embed Links* and *View Channel*
   permissions. This invite link works once you paste in your application ID:

   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=3148800&scope=bot%20applications.commands
   ```

Under **Bot -> Privileged Gateway Intents**, enable **MESSAGE CONTENT INTENT**.
Discord requires it for a bot to read `!play ...`. If you would rather not
enable it, set `PREFIX=` (empty) in `.env` and the bot runs on slash commands
alone, requesting no privileged intent at all.

### 3. Configure

```bash
cp .env.example .env
```

Fill in `DISCORD_TOKEN` and `CLIENT_ID`. Set `GUILD_ID` to your test server
while developing — those commands register instantly, whereas global commands
can take up to an hour to appear.

`PREFIX` defaults to `!`. Change it to any string you like (`?`, `.`, `m!`), or
set it to nothing to disable text commands.

### 4. Register the slash commands

```bash
npm run deploy
```

Re-run this whenever you add a command or change its name, description or
options.

### 5. Start the bot

```bash
npm start
```

To confirm the setup without logging in:

```bash
npm run verify
```

## Commands

Each command works two ways: as a slash command (`/play daft punk`) or with the
configured prefix (`!play daft punk`). The tables below show the slash form.

With a prefix, optional true/false options are written as flags — `!play daft
punk --next`, `!jump 3 --requeue` — and a search term needs no quotes. These
shorthands are also accepted: `p`, `q`, `np`, `s`/`next`, `v`/`vol`, `dc`,
`prev`/`back`, `repeat`, `h`.

### Music

| Command | What it does |
| --- | --- |
| `/play <query> [next]` | Play a search term or link. Suggests results as you type; `next` puts it at the front of the queue. |
| `/skip` | Skip the current track. |
| `/stop` | Stop playback and clear the queue. |
| `/pause` · `/resume` | Pause and resume playback. |
| `/queue [page]` | Show the queue, with a progress bar for the current track. |
| `/nowplaying` | Show what is playing, with elapsed time. |
| `/volume [percent]` | Show or set the volume (0–150). |
| `/loop <mode>` | Repeat off, this track, or the whole queue. |
| `/shuffle` | Shuffle the queued tracks. |
| `/seek <position>` | Jump to `90`, `1:30` or `1:02:03`. |
| `/jump <position> [requeue]` | Jump straight to a queued track. |
| `/remove <position>` | Remove one queued track. |
| `/previous` | Go back to the previous track. |
| `/autoplay` | Keep playing related tracks once the queue runs out. |
| `/filter <name>` | Toggle an audio filter (`bassboost`, `nightcore`, `vaporwave`, …) or clear them all. |
| `/leave` | Stop and leave the voice channel. |

### Utility

| Command | What it does |
| --- | --- |
| `/help` | List every command. |
| `/ping` | Latency and uptime. |

## Configuration

Everything below is optional and lives in `.env`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `GUILD_ID` | *(empty)* | Register commands to one server instead of globally. |
| `PREFIX` | `!` | Prefix for text commands. Empty disables them (and the privileged intent). |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | *(empty)* | Spotify links work without these, but album and playlist links are capped at 100 tracks until you add them. |
| `DEFAULT_VOLUME` | `50` | Starting volume for a new queue. |
| `LEAVE_ON_EMPTY_COOLDOWN` | `60` | Seconds before leaving an empty channel. `0` stays forever. |
| `LEAVE_ON_FINISH_COOLDOWN` | `60` | Seconds before leaving after the queue ends. `0` stays forever. |
| `MAX_PLAYLIST_SIZE` | `100` | Most tracks taken from one playlist link. |
| `EMBED_COLOR` | `#5865F2` | Accent colour for embeds. |

## Project layout

```
deploy.js                 Registers slash commands with Discord
scripts/verify.js         Offline health check (npm run verify)
src/
  index.js                Client + DisTube setup, entry point
  config.js               Reads and validates .env
  handlers/
    commandHandler.js     Loads src/commands/**
    eventHandler.js       Loads src/events/** onto the right emitter
  commands/
    music/                Playback commands
    utility/              /help and /ping
  events/
    client/               discord.js events (incl. messageCreate for prefixes)
    player/               DisTube events
  lib/
    ytdlp.js              yt-dlp process wrapper
    ytdlpPlugin.js        Custom DisTube extractor plugin
    messageContext.js     Adapts a Message to the interaction API
    embeds.js             Embed builders
    format.js             Duration, progress bar, text helpers
    guards.js             Shared voice-channel checks
    idle.js               Auto-leave timers
    send.js               Permission-checked channel sends
```

### Adding a command

Drop a file in `src/commands/music/` or `src/commands/utility/` exporting
`data` (a `SlashCommandBuilder`) and `execute`. It is picked up automatically —
then run `npm run deploy`. The folder name becomes its category in `/help`, and
it gains a prefix version for free.

## Implementation notes

Three things here differ from the DisTube examples you will find online, all
deliberately.

**The yt-dlp plugin is custom** (`src/lib/ytdlpPlugin.js`). The published
`@distube/yt-dlp` package passes `--no-call-home`, a flag current yt-dlp builds
have removed. yt-dlp answers with a deprecation notice on stderr, the package
merges stderr into stdout before calling `JSON.parse`, and the resulting
`SyntaxError` is thrown from inside a `close` listener — an *uncaught*
exception that kills the process on every lookup, and which a `try`/`catch`
around the call cannot intercept. The plugin here keeps the two streams apart,
guards the parse, and always rejects its promise instead. It still uses the
binary that `@distube/yt-dlp` downloads and keeps updated.

Making it an `ExtractorPlugin` rather than a `PlayableExtractorPlugin` also
gives it a `searchSong` method, which is what lets plain-text `/play` queries
and Spotify/Deezer links find something to actually stream.

**Auto-leave is implemented in the bot** (`src/lib/idle.js`). DisTube v5 removed
the `leaveOnEmpty`, `leaveOnFinish` and `leaveOnStop` options that v4 had, and
its `Events.EMPTY` is declared but never emitted. Empty channels are detected
through discord.js's `voiceStateUpdate`, and end-of-queue through DisTube's
`deleteQueue` event, which fires for every teardown (queue finished, `/stop`,
or autoplay running out).

**Prefix commands reuse the slash commands** rather than duplicating them.
`src/lib/messageContext.js` wraps a `Message` in an object shaped like a
`ChatInputCommandInteraction` — `deferReply` starts a typing indicator,
`editReply` sends or edits one message, and `options.getString(...)` reads
parsed arguments. So each command in `src/commands` is written once and works
from both entry points, and a new command gets both automatically.

## Troubleshooting

**Commands do not appear.** Run `npm run deploy`. If `GUILD_ID` is empty,
global commands can take up to an hour; set `GUILD_ID` for instant updates.
Also confirm the bot was invited with the `applications.commands` scope.

**Prefix commands do nothing.** Enable the **Message Content Intent** in the
Developer Portal (your app -> Bot -> Privileged Gateway Intents). Without it
Discord delivers empty message content, so the bot never sees the prefix. The
startup log prints which mode is active. Slash commands are unaffected.

**The bot joins but no sound plays.** Check that it has *Speak* in the channel,
and that nobody has server-muted it. Run `npm run verify` to confirm the stack
loads.

**A YouTube link fails to extract.** YouTube changes often; update the
extractor:

```bash
npm update @distube/yt-dlp
```

**Playback is choppy on a small VPS.** Opus encoding here is pure JavaScript
(`opusscript`), which is portable but CPU-hungry. If your machine has a C++
toolchain, `npm install @discordjs/opus` is a drop-in native replacement and is
picked up automatically.

## License

MIT
