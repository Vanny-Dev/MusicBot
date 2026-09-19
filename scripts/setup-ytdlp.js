"use strict";

/**
 * Download the standalone `yt-dlp` build into `bin/`, as an npm `postinstall`
 * step.
 *
 * `@distube/yt-dlp` fetches the *Python zipapp* release asset, whose shebang is
 * `#!/usr/bin/env python3`. That works on a developer machine with Python
 * installed and fails on a bare container with:
 *
 *     env: 'python3': No such file or directory
 *
 * The platform-specific builds below bundle their own interpreter, so they run
 * anywhere with no Python at all. Running as `postinstall` keeps this working
 * under any builder — Nixpacks, Railpack, a Dockerfile — because they all
 * install dependencies with npm.
 *
 * A failure here is never fatal: the install continues and `src/lib/ytdlp.js`
 * falls back to the binary `@distube/yt-dlp` downloaded.
 */

const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

/** Release asset for the current platform, keyed by `process.platform`. */
const ASSETS = {
  win32: "yt-dlp.exe",
  darwin: "yt-dlp_macos",
  linux: {
    arm64: "yt-dlp_linux_aarch64",
    arm: "yt-dlp_linux_armv7l",
    default: "yt-dlp_linux",
  },
};

/** Pin a version with YTDLP_VERSION, e.g. "2025.08.19". Defaults to latest. */
const VERSION = process.env.YTDLP_VERSION || "latest";

const BINARY_NAME = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const TARGET = path.join(__dirname, "..", "bin", BINARY_NAME);

function assetName() {
  const entry = ASSETS[process.platform];
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  return entry[process.arch] || entry.default;
}

function releaseUrl(asset) {
  const base = "https://github.com/yt-dlp/yt-dlp/releases";
  const segment = VERSION === "latest" ? "latest/download" : `download/${VERSION}`;
  return `${base}/${segment}/${asset}`;
}

async function main() {
  // An explicit path means the operator is supplying their own binary.
  if (process.env.YTDLP_PATH) {
    console.log("[setup-ytdlp] YTDLP_PATH is set; skipping download.");
    return;
  }
  if (process.env.YTDLP_SKIP_DOWNLOAD) {
    console.log("[setup-ytdlp] YTDLP_SKIP_DOWNLOAD is set; skipping download.");
    return;
  }

  const asset = assetName();
  if (!asset) {
    console.warn(`[setup-ytdlp] No standalone build for ${process.platform}; skipping.`);
    return;
  }

  const url = releaseUrl(asset);
  console.log(`[setup-ytdlp] Downloading ${asset} (${VERSION})…`);

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }

  // Write to a temporary name first, so an interrupted download can never
  // leave a half-written file that later looks like a working binary.
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  const temp = `${TARGET}.download`;
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temp));
  fs.renameSync(temp, TARGET);
  if (process.platform !== "win32") fs.chmodSync(TARGET, 0o755);

  console.log(`[setup-ytdlp] Installed ${TARGET}`);
}

main().catch((error) => {
  console.warn(`[setup-ytdlp] Could not download yt-dlp: ${error.message}`);
  console.warn("[setup-ytdlp] Falling back to the binary from @distube/yt-dlp.");
});
