const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'bl-list',
  description: 'List your blacklisted users',
  usage: '.bl-list',
  async execute(message, args, client, db) {
    const ownerId = message.author.id;
    const guildId = message.guild.id;

    db.all(
      `SELECT blacklisted_id FROM blacklist_users WHERE owner_id = ? AND guild_id = ?`,
      [ownerId, guildId],
      async (err, rows) => {
        if (err) {
          console.error('❌ Database error:', err);
          return message.reply({
            embeds: [new EmbedBuilder().setColor('000000').setDescription('❌ Database error.')]
          });
        }

        if (!rows.length) {
          return message.reply({
            embeds: [new EmbedBuilder().setColor('000000').setDescription('ℹ️ You have not blacklisted any users yet.')]
          });
        }

        // Format user mentions
        const userList = rows.map(r => `<@${r.blacklisted_id}>`).join('\n');

        message.reply({
          embeds: [new EmbedBuilder().setColor('000000').setDescription(`📋 Your blacklisted users:\n${userList}`)]
        });
      }
    );
  }
};
