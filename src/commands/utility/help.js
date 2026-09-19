"use strict";

const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const config = require("../../config");
const { joinWithinLimit } = require("../../lib/format");

/** Pretty names for the command folders. */
const CATEGORY_LABELS = {
  music: "🎵 Music",
  utility: "🛠️ Utility",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("List everything this bot can do"),

  /**
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   * @param {import("discord.js").Client} client
   */
  async execute(interaction, client) {
    const byCategory = new Map();
    for (const command of client.commands.values()) {
      const category = command.category ?? "other";
      if (!byCategory.has(category)) byCategory.set(category, []);
      byCategory.get(category).push(command);
    }

    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle("Command list")
      .setDescription(
        "Play from YouTube, Spotify, SoundCloud, Deezer and many more sites.\n" +
          "Start with `/play` and a search term or a link." +
          (config.prefix
            ? `\n\nEvery command also works with the \`${config.prefix}\` prefix — ` +
              `for example \`${config.prefix}play daft punk\`.`
            : ""),
      );

    for (const [category, commands] of [...byCategory.entries()].sort()) {
      const lines = commands
        .sort((a, b) => a.data.name.localeCompare(b.data.name))
        .map((command) => `\`/${command.data.name}\` — ${command.data.description}`);

      embed.addFields({
        name: CATEGORY_LABELS[category] ?? category,
        value: joinWithinLimit(lines),
      });
    }

    embed.setFooter({
      text: config.prefix
        ? `Tip: /play suggests results as you type. Shortcuts: ${config.prefix}p, ${config.prefix}q, ${config.prefix}np`
        : "Tip: /play suggests results as you type.",
    });

    await interaction.reply({ embeds: [embed] });
  },
};
