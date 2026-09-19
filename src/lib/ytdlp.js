"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

/**
 * Absolute path to the `yt-dlp` executable that `@distube/yt-dlp` downloads on
 * install. Resolving it through `require.resolve` keeps us pointed at the
 * package's own binary, so `npm install` / `npm update` keeps it current.
 */
const YTDLP_PATH =
  process.env.YTDLP_PATH ||
  path.join(
    // `.../@distube/yt-dlp/dist/index.js` -> `.../@distube/yt-dlp/bin/yt-dlp`
    path.dirname(require.resolve("@distube/yt-dlp")),
    "..",
    "bin",
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
  );

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
    const child = spawn(YTDLP_PATH, [...BASE_FLAGS, ...extraFlags, target], {
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
