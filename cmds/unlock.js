const { EmbedBuilder, PermissionFlagsBits, OverwriteType } = require('discord.js');

module.exports = {
  name: 'unlock',
  description: 'Unlock your temporary voice channel for everyone, and clear per-user DENY overwrites.',
  usage: '.v unlock',
  async execute(message, args, client, db) {
    const guild = message.guild;
    const author = message.member;
    const voiceChannel = author?.voice?.channel;

    if (!guild || !voiceChannel) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setColor('Red').setDescription('   You must be connected to your temp voice channel.')]
      });
    }

    try {
      // Confirm this channel is managed by the bot and who the owner is
      const row = await new Promise((resolve, reject) => {
        db.get(
          `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
          [voiceChannel.id, guild.id],
          (err, r) => err ? reject(err) : resolve(r)
        );
      });
      if (!row) {
        return message.channel.send({
          embeds: [new EmbedBuilder().setColor('Red').setDescription('   This voice channel is not managed by the bot.')]
        });
      }
      const ownerId = row.owner_id;

      // Helper to check manager
      async function isManagerOf(ownerId, userId) {
        return await new Promise((resolve) => {
          db.get(
            `SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?`,
            [ownerId, userId],
            (err, r) => resolve(!!r)
          );
        });
      }

      // Only the owner or a manager can unlock
      const isOwner = author.id === ownerId;
      const isManager = await isManagerOf(ownerId, author.id);
      if (!isOwner && !isManager) {
        return message.channel.send({
          embeds: [new EmbedBuilder().setColor('Red').setDescription('   Only the voice owner or their manager can unlock this channel.')]
        });
      }

      // 1) Make sure @everyone can VIEW + CONNECT
      await voiceChannel.permissionOverwrites.edit(
        guild.roles.everyone,
        { ViewChannel: true, Connect: true },
        { reason: 'Unlock: allow everyone' }
      );

      // 2) Clear per-user DENY overwrites that block entering (Connect / ViewChannel)
      const overwrites = voiceChannel.permissionOverwrites.cache;
      for (const [id, ow] of overwrites) {
        if (ow.type !== OverwriteType.Member) continue;
        const deniesConnect = ow.deny.has(PermissionFlagsBits.Connect);
        const deniesView = ow.deny.has(PermissionFlagsBits.ViewChannel);
        if (deniesConnect || deniesView) {
          await voiceChannel.permissionOverwrites.delete(id, 'Unlock: clearing per-user denies');
        }
      }

      // 3) Strip lock icon if present
      if (voiceChannel.name.startsWith('🔒 ')) {
        await voiceChannel.setName(voiceChannel.name.replace(/^🔒\s*/, ''), 'Unlock: remove lock marker');
      }

      // 4) Remove from locked table if present
      await new Promise((resolve) => {
        db.run(`DELETE FROM locked_channels WHERE channel_id = ? AND guild_id = ?`, [voiceChannel.id, guild.id], () => resolve());
      });

      return message.channel.send({
        embeds: [new EmbedBuilder().setColor('Green').setDescription('<:arcadiatruee:14017526279914517652>  Channel unlocked. Any previous per-user denies were cleared.')]
      });
    } catch (err) {
      console.error('unlock error:', err);
      return message.channel.send({
        embeds: [new EmbedBuilder().setColor('Red').setDescription('   Failed to unlock the channel. Make sure I can manage channel permissions.')]
      });
    }
  }
};
