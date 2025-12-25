// cmds/wladd.js
const { EmbedBuilder, PermissionFlagsBits, OverwriteType } = require('discord.js');

const DEV_IDS = (process.env.DEV_IDS || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

function getTargetId(message, args) {
  const m = message.mentions?.users?.first();
  if (m) return m.id;
  const raw = (args[0] || '').trim();
  if (!raw) return null;
  const id = raw.replace(/[<@!>]/g, '');
  return /^\d{10,}$/.test(id) ? id : null;
}

module.exports = {
  name: 'wladd',
  description: 'Add a user to the whitelist of your current temp voice. Owner/Devs only.',
  usage: '.v wladd @user / ID',
  async execute(message, args, client, db) {
    const guild = message.guild;
    const author = message.member;
    if (!guild || !author) return;

    const voice = author.voice?.channel;
    if (!voice) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('You must be **in your temp voice channel**.') ]
      });
    }

    const guildId = guild.id;

    // Who owns this temp VC?
    const row = await new Promise(res => {
      db.get(
        `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
        [voice.id, guildId],
        (e, r) => res(r)
      );
    });

    if (!row) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('This voice is **not** registered as a temp channel.') ]
      });
    }

    const ownerId = row.owner_id;

    // --- Authorization: ONLY temp owner or a DEV ---
    const isOwner = message.author.id === ownerId;
    const isDev = DEV_IDS.includes(message.author.id);
    if (!(isOwner || isDev)) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000')
          .setDescription('Only the **temp owner** or configured **devs** can use this command.') ]
      });
    }

    // Target
    const id = getTargetId(message, args);
    if (!id) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('Please mention a user or provide a **valid user ID**.') ]
      });
    }
    if (id === ownerId) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('Owner is already allowed; no need to whitelist.') ]
      });
    }

    const member = await guild.members.fetch(id).catch(() => null);
    if (!member) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('User not found in this server.') ]
      });
    }

    // Already whitelisted?
    const exists = await new Promise(res => {
      db.get(
        `SELECT 1 FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?`,
        [ownerId, id, guildId],
        (e, r) => res(!!r)
      );
    });
    if (exists) {
      return message.reply({
        embeds: [ new EmbedBuilder().setColor('000000').setDescription('User is **already** on your whitelist.') ]
      });
    }

    // Remove from blacklist if present
    await new Promise(res => {
      db.run(
        `DELETE FROM blacklist_users WHERE owner_id = ? AND blacklisted_id = ? AND guild_id = ?`,
        [ownerId, id, guildId],
        () => res()
      );
    });

    // Insert whitelist
    await new Promise((res, rej) => {
      db.run(
        `INSERT OR IGNORE INTO whitelist_users (owner_id, whitelisted_id, guild_id) VALUES (?, ?, ?)`,
        [ownerId, id, guildId],
        (err) => err ? rej(err) : res()
      );
    }).catch(console.error);

    // Ensure channel overwrites: clear DENY then ALLOW CONNECT/VIEW
    try {
      const existingOw = voice.permissionOverwrites.resolve(id);
      if (existingOw && (
        existingOw.deny?.has?.(PermissionFlagsBits.Connect) ||
        existingOw.deny?.has?.(PermissionFlagsBits.ViewChannel)
      )) {
        await voice.permissionOverwrites.edit(
          id,
          { Connect: null, ViewChannel: null },
          { type: OverwriteType.Member }
        ).catch(() => {});
      }
      await voice.permissionOverwrites.edit(
        id,
        { Connect: true, ViewChannel: true },
        { type: OverwriteType.Member }
      ).catch(() => {});
    } catch (e) {
      console.error('[wladd] overwrite error:', e?.message || e);
    }

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#2b2d31')
          .setDescription(`<:arcadiatruee:1401752627422517652>  Added <@${id}> to your voice whitelist.`)
      ]
    });
  }
};
