"use strict";

/**
 * Format a number of seconds as `m:ss`, or `h:mm:ss` once it passes an hour.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/**
 * Parse a human timestamp into seconds. Accepts `90`, `1:30` and `1:02:03`.
 * @param {string} input
 * @returns {number | null} Seconds, or `null` when the input is not a timestamp.
 */
function parseDuration(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  if (!/^\d+(:[0-5]?\d){0,2}$/.test(raw)) return null;
  return raw
    .split(":")
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}

/**
 * Draw a text progress bar, e.g. `▬▬▬🔘▬▬▬▬▬▬`.
 * @param {number} current Elapsed seconds.
 * @param {number} total Total seconds. A falsy total renders an empty bar.
 * @param {number} [size] Number of characters in the bar.
 * @returns {string}
 */
function progressBar(current, total, size = 18) {
  if (!total || total <= 0) return "🔘" + "▬".repeat(size - 1);
  const ratio = Math.min(Math.max(current / total, 0), 1);
  const position = Math.min(Math.round(ratio * (size - 1)), size - 1);
  return "▬".repeat(position) + "🔘" + "▬".repeat(size - 1 - position);
}

/**
 * Shorten text to `max` characters, adding an ellipsis when it was cut.
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
function truncate(text, max = 60) {
  const value = String(text ?? "");
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/**
 * Escape Discord markdown so that song titles containing `*`, `_` or `[` do
 * not turn an embed into a mess of italics and broken links.
 * @param {string} text
 * @returns {string}
 */
function escapeMarkdown(text) {
  return String(text ?? "").replace(/([*_`~\\|[\]()>])/g, "\\$1");
}

/**
 * Render a song as a markdown link, safe to drop into an embed.
 * @param {import("distube").Song} song
 * @param {number} [max]
 * @returns {string}
 */
function songLink(song, max = 60) {
  const name = escapeMarkdown(truncate(song?.name ?? "Unknown track", max));
  return song?.url ? `[${name}](${song.url})` : name;
}

/**
 * Join lines with newlines, dropping any that would push the result past
 * Discord's limit for an embed field value (1024 characters).
 *
 * @param {string[]} lines
 * @param {number} [max]
 * @returns {string}
 */
function joinWithinLimit(lines, max = 1024) {
  if (!lines.length) return "";

  const kept = [];
  let length = 0;
  let truncated = false;

  for (const line of lines) {
    const cost = line.length + (kept.length ? 1 : 0);
    if (length + cost > max) {
      truncated = true;
      break;
    }
    kept.push(line);
    length += cost;
  }

  if (!truncated) return kept.join("\n");

  // Drop trailing entries until the "…and N more" note fits too. The note is
  // recalculated each time, since dropping an entry changes the count.
  const noteFor = (count) => `…and ${count} more`;
  while (kept.length && length + noteFor(lines.length - kept.length).length + 1 > max) {
    const dropped = kept.pop();
    length = kept.length ? length - (dropped.length + 1) : 0;
  }

  kept.push(noteFor(lines.length - kept.length));
  return kept.join("\n");
}

module.exports = {
  formatDuration,
  parseDuration,
  progressBar,
  truncate,
  escapeMarkdown,
  songLink,
  joinWithinLimit,
};
