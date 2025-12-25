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
  name: 'limitguard',
  description: 'Toggle Limit-Guard (guild-wide): auto-kick on channels with a user limit, even if Anti-Admin is OFF.',
  usage: '.v limitguard <on|off>',
  async execute(message, args, client, db) {
    const sub = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(sub)) {
      return message.reply({
        embeds: [
          new EmbedBuilder().setColor('000000')
            .setDescription('Usage: `.v limitguard on` or `.v limitguard off`')
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
      `INSERT INTO limitguard_settings (guild_id, enabled)
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
                ? '✅ Limit-Guard is now **ON** (guild-wide).'
                : '⭕ Limit-Guard is now **OFF** (guild-wide).')
          ]
        });
      }
    );
  }
};
