const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'wl-remove',
  description: 'Remove a user from your whitelist',
  usage: '.wl-remove @user / ID',
  async execute(message, args, client, db) {
    const ownerId = message.author.id;
    const guildId = message.guild.id;

    if (!args[0]) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('000000')
          .setDescription('   Please mention a user or provide their ID to remove from your whitelist.')]
      });
    }

    // helper: extract ID from mention or raw
    const extractId = (arg) => {
      if (!arg) return null;
      const mentionMatch = arg.match(/^<@!?(\d{17,20})>$/);
      if (mentionMatch) return mentionMatch[1];
      if (/^\d{17,20}$/.test(arg)) return arg;
      return null;
    };

    const targetId = extractId(args[0]);
    if (!targetId) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('000000')
          .setDescription('   Invalid user mention or ID.')]
      });
    }

    let user;
    try {
      user = await client.users.fetch(targetId, { force: true });
    } catch {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('000000')
          .setDescription('   Could not find that user.')]
      });
    }

    db.get(
      `SELECT * FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?`,
      [ownerId, user.id, guildId],
      (err, row) => {
        if (err) {
          return message.reply({
            embeds: [new EmbedBuilder()
              .setColor('000000')
              .setDescription('   Database error.')]
          });
        }

        if (!row) {
          return message.reply({
            embeds: [new EmbedBuilder()
              .setColor('000000')
              .setDescription(`⚠️ <@${user.id}> is not in your whitelist.`)]
          });
        }

        db.run(
          `DELETE FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?`,
          [ownerId, user.id, guildId],
          (err2) => {
            if (err2) {
              return message.reply({
                embeds: [new EmbedBuilder()
                  .setColor('000000')
                  .setDescription('   Failed to remove whitelist.')]
              });
            }

            message.reply({
              embeds: [new EmbedBuilder()
                .setColor('000000')
                .setDescription(`<:arcadiatruee:1401752463144517652>  You have removed <@${user.id}> from your whitelist.`)]
            });
          }
        );
      }
    );
  }
};
