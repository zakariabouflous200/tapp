const { EmbedBuilder } = require('discord.js');

const DEV_IDS = (process.env.DEV_IDS || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

function isAuthorized(message) {
  const isOwner = message.guild?.ownerId === message.author.id;
  const isDev = DEV_IDS.includes(message.author.id);
  return isOwner || isDev;
}

module.exports = {
  name: 'antiadmin',
  description: 'Toggle Anti-Admin mode (guild-wide). Only server owner or devs can use this.',
  usage: '.v antiadmin <on|off>',
  async execute(message, args, client, db) {
    const sub = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(sub)) {
      return message.reply({
        embeds: [
          new EmbedBuilder().setColor('000000')
            .setDescription('Usage: `.v antiadmin on` or `.v antiadmin off`')
        ]
      });
    }

    if (!isAuthorized(message)) {
      return message.reply({
        embeds: [
          new EmbedBuilder().setColor('000000')
            .setDescription('   Only the **server owner** or configured **devs** can use this command.')
        ]
      });
    }

    const guildId = message.guild.id;
    const enabled = sub === 'on' ? 1 : 0;

    db.run(
      `INSERT INTO antiadmin_settings (guild_id, enabled)
       VALUES (?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET enabled=excluded.enabled`,
      [guildId, enabled],
      (err) => {
        if (err) {
          console.error(err);
          return message.reply({
            embeds: [new EmbedBuilder().setColor('000000').setDescription('Database error.')]
          });
        }
        return message.reply({
          embeds: [
            new EmbedBuilder().setColor('000000')
              .setDescription(enabled
                ? '✅ Anti-Admin is now **ON** (guild-wide).'
                : '⭕ Anti-Admin is now **OFF** (guild-wide).')
          ]
        });
      }
    );
  }
};
