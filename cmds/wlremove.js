const { EmbedBuilder } = require('discord.js');

const DEV_IDS = (process.env.DEV_IDS || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

function isAuthorized(message) {
  return message.guild?.ownerId === message.author.id || DEV_IDS.includes(message.author.id);
}

function getTargetId(message, args) {
  const m = message.mentions?.users?.first();
  if (m) return m.id;

  const raw = (args[0] || '').trim();
  if (!raw) return null;

  const id = raw.replace(/[<@!>]/g, '');
  return /^\d{10,}$/.test(id) ? id : null;
}

module.exports = {
  name: 'wlremove',
  description: 'Remove a user from the whitelist of the current temp voice. Owner/Devs only.',
  usage: '.v wlremove @user / ID',
  async execute(message, args, client, db) {
    if (!isAuthorized(message)) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('Only the **server owner** or configured **devs** can use this command.') ]
      });
    }

    const guild = message.guild;
    const author = message.member;
    const guildId = guild.id;

    const voice = author?.voice?.channel;
    if (!voice) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('You must be in a temporary voice channel.') ]
      });
    }

    const row = await new Promise(res => {
      db.get(
        `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
        [voice.id, guildId],
        (e, r) => res(r)
      );
    });
    if (!row) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('This voice channel is not registered as a temporary channel.') ]
      });
    }
    const ownerId = row.owner_id;

    const id = getTargetId(message, args);
    if (!id) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('Please mention a user or provide a valid user ID.') ]
      });
    }

    const exists = await new Promise(res => {
      db.get(
        `SELECT 1 FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?`,
        [ownerId, id, guildId],
        (e, r) => res(!!r)
      );
    });
    if (!exists) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('User is not on this whitelist.') ]
      });
    }

    await new Promise((res, rej) => {
      db.run(
        `DELETE FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?`,
        [ownerId, id, guildId],
        (err) => err ? rej(err) : res()
      );
    }).catch(console.error);

    // Clean up explicit overwrite if we created it before
    try {
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) {
        const ow = voice.permissionOverwrites.cache.get(member.id);
        if (ow) await ow.delete().catch(() => {});
      }
    } catch {}

    return message.reply({
      embeds: [ new EmbedBuilder().setColor('#2b2d31').setDescription(`<:arcadiatruee:1401752463144517652>  Removed <@${id}> from the whitelist for this voice.`) ]
    });
  }
};
