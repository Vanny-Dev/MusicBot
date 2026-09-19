"use strict";

const { ExtractorPlugin, Playlist, Song } = require("distube");
const { ytdlpJson } = require("./ytdlp");

/**
 * Number of results requested from YouTube for a single search. The first
 * playable hit wins; the rest are used for `/play` autocomplete.
 */
const SEARCH_LIMIT = 10;

/**
 * Format string handed to yt-dlp when picking a stream. Preference order: an
 * Opus-only track (what Discord wants anyway), then any audio-only track, then
 * whatever else exists so that unusual sources still play.
 */
const AUDIO_FORMAT = "bestaudio[acodec=opus]/bestaudio/bestaudio*/best";

/** Pick the largest thumbnail yt-dlp reported, if it reported any. */
function pickThumbnail(info) {
  if (typeof info.thumbnail === "string") return info.thumbnail;
  const thumbnails = Array.isArray(info.thumbnails) ? info.thumbnails : [];
  const best = thumbnails
    .filter((t) => typeof t?.url === "string")
    .sort((a, b) => (a.preference ?? 0) - (b.preference ?? 0))
    .pop();
  return best?.url;
}

/**
 * Translate one yt-dlp entry into the shape DisTube's {@link Song} expects.
 *
 * yt-dlp uses slightly different keys for a full extraction and for a
 * `--flat-playlist` entry, so both spellings are accepted here.
 */
function toSongInfo(plugin, info) {
  const isLive = Boolean(info.is_live || info.live_status === "is_live");
  return {
    plugin,
    source:
      info.extractor_key?.toLowerCase() ||
      info.extractor ||
      info.ie_key?.toLowerCase() ||
      "youtube",
    playFromSource: true,
    id: String(info.id),
    name: info.title || info.fulltitle || undefined,
    isLive,
    // Live streams have no meaningful length; DisTube reads 0 as "unknown".
    duration: isLive ? 0 : Number(info.duration) || 0,
    url: info.webpage_url || info.url || info.original_url,
    thumbnail: pickThumbnail(info),
    views: Number(info.view_count) || undefined,
    likes: Number(info.like_count) || undefined,
    uploader: {
      name: info.uploader || info.channel || info.creator || undefined,
      url: info.uploader_url || info.channel_url || undefined,
    },
    ageRestricted: Number(info.age_limit) >= 18,
  };
}

/** True when a yt-dlp document describes a playlist rather than one track. */
function isPlaylistInfo(info) {
  return (
    info?._type === "playlist" ||
    info?._type === "multi_video" ||
    Array.isArray(info?.entries)
  );
}

/** Pull the YouTube video id out of a watch / shorts / youtu.be URL. */
function youtubeVideoId(url) {
  if (typeof url !== "string") return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return match?.[1] ?? null;
}

/**
 * A DisTube extractor backed by the `yt-dlp` binary.
 *
 * This replaces the stock `@distube/yt-dlp` plugin, which still passes the
 * removed `--no-call-home` flag. Current yt-dlp builds answer that with a
 * deprecation notice, the stock wrapper folds stderr into stdout, and the
 * resulting `JSON.parse` throws from inside a `close` listener - an uncaught
 * exception that takes the whole process down on every lookup. Everything here
 * goes through {@link ytdlpJson}, which keeps the two streams apart and always
 * rejects instead of throwing asynchronously.
 *
 * Being an `ExtractorPlugin` (rather than a `PlayableExtractorPlugin`) also
 * lets it answer plain-text searches, so `/play never gonna give you up`
 * works, and so Spotify and Deezer links - which only carry metadata - have
 * somewhere to look their tracks up.
 */
class YtDlpPlugin extends ExtractorPlugin {
  /**
   * @param {{ maxPlaylistSize?: number }} [options]
   */
  constructor({ maxPlaylistSize = 100 } = {}) {
    super();
    this.maxPlaylistSize = maxPlaylistSize;
  }

  /**
   * yt-dlp supports well over a thousand sites, so this plugin is the
   * catch-all. It must therefore be registered **last**, after every plugin
   * that handles one specific service.
   */
  validate() {
    return true;
  }

  /**
   * Resolve a URL into a {@link Song} or a {@link Playlist}.
   * @param {string} url
   * @param {import("distube").ResolveOptions} [options]
   */
  async resolve(url, options = {}) {
    // Only expand a playlist when the link really points at one, so that a
    // "watch?v=...&list=..." URL does not quietly queue a hundred extra
    // tracks the user never asked for.
    const wantsPlaylist = /[?&]list=/.test(url) && !/[?&]v=/.test(url);
    const flags = wantsPlaylist
      ? [
          "--yes-playlist",
          "--flat-playlist",
          "--playlist-end",
          String(this.maxPlaylistSize),
        ]
      : ["--no-playlist"];

    const info = await ytdlpJson(url, flags);

    if (isPlaylistInfo(info)) {
      const entries = (info.entries || []).filter((entry) => entry && entry.id);
      if (!entries.length) {
        throw new Error("That playlist is empty or entirely unavailable.");
      }
      return new Playlist(
        {
          source:
            info.extractor_key?.toLowerCase() || info.extractor || "youtube",
          songs: entries.map((entry) => new Song(toSongInfo(this, entry), options)),
          id: info.id ? String(info.id) : undefined,
          name: info.title,
          url: info.webpage_url || url,
          thumbnail: pickThumbnail(info),
        },
        options,
      );
    }

    return new Song(toSongInfo(this, info), options);
  }

  /**
   * Search YouTube and return the best hit, or `null` when nothing matches.
   * @param {string} query
   * @param {import("distube").ResolveOptions} [options]
   */
  async searchSong(query, options = {}) {
    const results = await this.search(query, 1);
    if (!results.length) return null;
    return new Song(toSongInfo(this, results[0]), options);
  }

  /**
   * Raw YouTube search, used by {@link searchSong} and by `/play` autocomplete.
   * Returns yt-dlp entries rather than {@link Song}s so the autocomplete
   * handler can render suggestions without building throwaway objects.
   *
   * @param {string} query
   * @param {number} [limit]
   * @returns {Promise<any[]>}
   */
  async search(query, limit = SEARCH_LIMIT) {
    const term = query.replace(/[\r\n]+/g, " ").trim();
    if (!term) return [];
    const count = Math.max(1, Math.min(limit, 25));

    // DisTube catches every error a search throws and reports a bare
    // `NO_RESULT`, which hides the real cause (a YouTube bot check, a missing
    // binary, a blocked network). Log it here, where we still have it.
    let info;
    try {
      info = await ytdlpJson(`ytsearch${count}:${term}`, ["--flat-playlist"]);
    } catch (error) {
      console.error(`[yt-dlp] Search failed for "${term}": ${error.message}`);
      throw error;
    }

    const entries = (info.entries || []).filter((entry) => entry && entry.id && entry.title);
    if (!entries.length) {
      console.warn(`[yt-dlp] Search returned no usable entries for "${term}".`);
    }
    return entries;
  }

  /**
   * Ask yt-dlp for a direct, playable audio URL.
   * @param {import("distube").Song} song
   */
  async getStreamURL(song) {
    if (!song.url) {
      throw new Error(`Cannot get a stream URL for "${song.name ?? song.id}".`);
    }
    const info = await ytdlpJson(song.url, [
      "--no-playlist",
      "--format",
      AUDIO_FORMAT,
    ]);
    const url = info.url || info.requested_downloads?.[0]?.url;
    if (!url) {
      throw new Error(`No playable audio format found for "${song.name ?? song.url}".`);
    }
    return url;
  }

  /**
   * Songs used by autoplay once the queue runs dry.
   *
   * yt-dlp does not expose YouTube's "related videos" list, so this reads the
   * auto-generated radio mix for the track (the `RD<videoId>` playlist), which
   * is what YouTube itself would play next.
   *
   * @param {import("distube").Song} song
   * @returns {Promise<import("distube").Song[]>}
   */
  async getRelatedSongs(song) {
    const videoId =
      youtubeVideoId(song?.url) ??
      (/^[A-Za-z0-9_-]{11}$/.test(song?.id ?? "") ? song.id : null);
    if (!videoId) return [];

    try {
      const info = await ytdlpJson(
        `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`,
        ["--yes-playlist", "--flat-playlist", "--playlist-end", "20"],
      );
      return (info.entries || [])
        .filter((entry) => entry?.id && entry.id !== videoId)
        .map((entry) => new Song(toSongInfo(this, entry)));
    } catch {
      // Some tracks (private, region-locked, or simply not YouTube) have no
      // mix. DisTube turns an empty list into its `noRelated` event.
      return [];
    }
  }
}

module.exports = { YtDlpPlugin };
