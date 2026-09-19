"use strict";

const { SlashCommandBuilder } = require("discord.js");

const embeds = require("../../lib/embeds");
const { requireVoice } = require("../../lib/guards");
const { cancelLeave } = require("../../lib/idle");
const { formatDuration, truncate } = require("../../lib/format");
const { YtDlpPlugin } = require("../../lib/ytdlpPlugin");

/** Discord allows at most 25 autocomplete choices, and 100 chars per name. */
const MAX_CHOICES = 25;
const MAX_CHOICE_NAME = 100;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a track, or add it to the queue")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("A search term, or a link (YouTube, Spotify, SoundCloud, Deezer, ...)")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("next")
        .setDescription("Put this at the front of the queue instead of the end")
        .setRequired(false),
    ),

  /**
   * Suggest YouTube results as the user types.
   * @param {import("discord.js").AutocompleteInteraction} interaction
   */
  async autocomplete(interaction) {
    const query = interaction.options.getFocused().trim();

    // A URL needs no suggestions, and very short terms match everything.
    if (!query || query.length < 3 || /^https?:\/\//i.test(query)) {
      await interaction.respond([]);
      return;
    }

    const plugin = interaction.client.distube.plugins.find((p) => p instanceof YtDlpPlugin);
    if (!plugin) {
      await interaction.respond([]);
      return;
    }

    const results = await plugin.search(query, MAX_CHOICES).catch(() => []);

    const choices = results.slice(0, MAX_CHOICES).map((entry) => {
      const length = entry.live_status === "is_live" ? "LIVE" : formatDuration(entry.duration);
      const uploader = entry.channel || entry.uploader || "Unknown";
      const label = `${entry.title} · ${uploader} · ${length}`;
      return {
        name: truncate(label, MAX_CHOICE_NAME),
        // The value is what /play receives, so hand it a URL to resolve
        // directly instead of searching for the same thing a second time.
        value: `https://www.youtube.com/watch?v=${entry.id}`,
      };
    });

    // The interaction may have been superseded while the search ran.
    if (!interaction.responded) await interaction.respond(choices).catch(() => {});
  },

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    await interaction.deferReply();

    const context = await requireVoice(interaction);
    if (!context) return;

    const query = interaction.options.getString("query", true);
    const playNext = interaction.options.getBoolean("next") ?? false;

    cancelLeave(interaction.guildId);

    try {
      await interaction.client.distube.play(context.voiceChannel, query, {
        member: interaction.member,
        textChannel: interaction.channel,
        // Position 1 is "directly after the current song"; 0 means append.
        position: playNext ? 1 : 0,
      });

      // The addSong / addList / playSong events post the result publicly, so
      // there is nothing useful left in the deferred reply.
      await interaction.deleteReply().catch(() => {});
    } catch (error) {
      console.error("[play] Failed to play:", error);
      await interaction.editReply({
        embeds: [
          embeds.error(
            `Could not play that.\n\`\`\`\n${truncate(String(error?.message ?? error), 300)}\n\`\`\``,
          ),
        ],
      });
    }
  },
};
