"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BINARY_NAME = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";

/**
 * The standalone build downloaded by `scripts/setup-ytdlp.js` on install. It
 * bundles its own Python interpreter, so it runs on a bare container.
 */
const STANDALONE_BINARY = path.join(__dirname, "..", "..", "bin", BINARY_NAME);

/**
 * The binary `@distube/yt-dlp` downloads on install. This is the *Python
 * zipapp* release, so it needs a `python3` on PATH and fails with
 * "env: 'python3': No such file or directory" where there is none. Used only
 * when the standalone build is missing.
 */
const PACKAGE_BINARY = path.join(
  // `.../@distube/yt-dlp/dist/index.js` -> `.../@distube/yt-dlp/bin/yt-dlp`
  path.dirname(require.resolve("@distube/yt-dlp")),
  "..",
  "bin",
  BINARY_NAME,
);

/** Absolute path to the `yt-dlp` executable this bot will run. */
const YTDLP_PATH =
  process.env.YTDLP_PATH ||
  (fs.existsSync(STANDALONE_BINARY) ? STANDALONE_BINARY : PACKAGE_BINARY);

/**
 * Flags shared by every metadata lookup.
 *
 * `--quiet` and `--no-warnings` matter a great deal here: yt-dlp writes
 * progress lines, warnings and deprecation notices to stderr, and anything that
 * leaks into stdout would corrupt the JSON document we parse. We also avoid
 * deprecated flags (such as `--no-call-home`) for the same reason.
 */
const BASE_FLAGS = [
  "--dump-single-json",
  "--skip-download",
  "--simulate",
  "--no-progress",
  "--no-warnings",
  "--quiet",
  "--ignore-config",
];

/**
 * Resolve the cookie file to pass to yt-dlp, or `null` when none is set.
 *
 * YouTube answers requests from datacenter IPs with "Sign in to confirm you're
 * not a bot", which no amount of retrying gets past. Cookies from a signed-in
 * session are the usual way through.
 *
 * Two spellings are accepted, because a platform like Railway has no
 * filesystem to upload a cookie file to:
 *
 * - `YTDLP_COOKIES` — a path to a Netscape-format cookie file.
 * - `YTDLP_COOKIES_CONTENT` — the file's *contents*, as an environment
 *   variable. Written to a private temporary file on first use. Literal `\n`
 *   sequences are treated as newlines, so a single-line value also works.
 *
 * Use a throwaway Google account: these cookies grant access to it, and
 * YouTube invalidates them periodically, so expect to refresh them.
 *
 * @returns {string | null}
 */
let cookieFile;
function resolveCookieFile() {
  if (cookieFile !== undefined) return cookieFile;

  const explicit = process.env.YTDLP_COOKIES?.trim();
  if (explicit) {
    cookieFile = explicit;
    return cookieFile;
  }

  const content = process.env.YTDLP_COOKIES_CONTENT;
  if (content?.trim()) {
    const text = content.includes("\n") ? content : content.replace(/\\n/g, "\n");
    const file = path.join(os.tmpdir(), "yt-dlp-cookies.txt");
    try {
      fs.writeFileSync(file, text.endsWith("\n") ? text : `${text}\n`, { mode: 0o600 });
      cookieFile = file;
      return cookieFile;
    } catch (error) {
      console.error(`[yt-dlp] Could not write the cookie file: ${error.message}`);
    }
  }

  cookieFile = null;
  return cookieFile;
}

/**
 * Flags built from the environment, so authentication and extraction strategy
 * can change without a code change.
 *
 * `YTDLP_EXTRACTOR_ARGS` is the cookie-free lever: YouTube's clients differ in
 * how aggressively they challenge, so a value like
 * `youtube:player_client=tv_simply` sometimes succeeds where the default
 * fails. Which clients work shifts over time — check the yt-dlp issue tracker
 * before assuming a value is still good.
 *
 * `YTDLP_PROXY` routes requests somewhere other than the host's own IP, which
 * is the only reliable fix when the IP itself is what YouTube objects to.
 *
 * `YTDLP_JS_RUNTIMES` picks the JavaScript runtime yt-dlp uses to solve
 * YouTube's challenges. See {@link JS_RUNTIMES} below.
 *
 * @returns {string[]}
 */
function environmentFlags() {
  const flags = [];

  // YouTube hides its format URLs behind JavaScript challenges, and yt-dlp
  // solves them with an external runtime. Its default is Deno, which a Node
  // image has no reason to carry; Node 22+ works just as well but has to be
  // asked for by name. Without a runtime yt-dlp finds no formats at all and
  // reports "Requested format is not available".
  //
  // Node is always present here — the bot itself requires 22.12+ — so it is
  // the default. Set YTDLP_JS_RUNTIMES to empty to drop the flag entirely,
  // which is what an older pinned yt-dlp (one predating --js-runtimes) needs.
  const jsRuntimes = (process.env.YTDLP_JS_RUNTIMES ?? "node").trim();
  if (jsRuntimes) flags.push("--js-runtimes", jsRuntimes);

  const cookies = resolveCookieFile();
  if (cookies) flags.push("--cookies", cookies);

  const extractorArgs = process.env.YTDLP_EXTRACTOR_ARGS?.trim();
  if (extractorArgs) flags.push("--extractor-args", extractorArgs);

  const proxy = process.env.YTDLP_PROXY?.trim();
  if (proxy) flags.push("--proxy", proxy);

  return flags;
}

/**
 * Run yt-dlp and parse its JSON output.
 *
 * Unlike the wrapper shipped by `@distube/yt-dlp`, stdout and stderr are kept
 * apart and the parse is guarded, so a malformed response rejects the promise
 * instead of throwing an uncaught exception that would take the bot down.
 *
 * @param {string} target A URL, or a `ytsearch<n>:<query>` style search term.
 * @param {string[]} [extraFlags] Additional yt-dlp command line flags.
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<any>} The parsed yt-dlp JSON document.
 */
function ytdlpJson(target, extraFlags = [], { timeout = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const args = [...BASE_FLAGS, ...environmentFlags(), ...extraFlags, target];
    const child = spawn(YTDLP_PATH, args, {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`yt-dlp timed out after ${timeout}ms for "${target}"`));
    }, timeout);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) =>
      finish(new Error(`Could not run yt-dlp (${YTDLP_PATH}): ${error.message}`)),
    );

    child.on("close", (code) => {
      if (code !== 0) {
        finish(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
        return;
      }
      try {
        finish(null, JSON.parse(stdout));
      } catch {
        finish(new Error(`yt-dlp returned unreadable output for "${target}"`));
      }
    });
  });
}

module.exports = { YTDLP_PATH, ytdlpJson };
