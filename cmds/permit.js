const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'permit',
  description: 'Allow a user permission to connect, speak, and send messages in your voice channel (and its related text channel).',
  usage: '.v permit <user>',
  async execute(message, args, client, db) {
    const guild = message.guild;
    const author = message.member;

    if (!args[0]) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription('  Please provide a user ID or mention.\nUsage: `.v permit <user>`')
            .setColor('Red')
            .setTimestamp()
        ]
      });
    }

    // Get the target member from mention or ID
    let targetId = args[0].replace(/[<@!>]/g, '');
    const targetMember = guild.members.cache.get(targetId);

    if (!targetMember) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription('  User not found in this server.')
            .setColor('Red')
            .setTimestamp()
        ]
      });
    }

    const voiceChannel = author.voice.channel;
    if (!voiceChannel) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription('  You need to be connected to your voice channel to use this command.')
            .setColor('Red')
            .setTimestamp()
        ]
      });
    }

    const guildId = guild.id;
    const voiceChannelId = voiceChannel.id;

    db.get(
      `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
      [voiceChannelId, guildId],
      async (err, row) => {
        if (err) {
          console.error(err);
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setDescription('  Database error occurred. Try again later.')
                .setColor('Red')
                .setTimestamp()
            ]
          });
        }

        if (!row) {
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setDescription('  This voice channel is not managed by the bot.')
                .setColor('Orange')
                .setTimestamp()
            ]
          });
        }

        const ownerId = row.owner_id;

        // Check if the author is the owner or a manager of the owner
        if (author.id !== ownerId && !(await isManagerOf(ownerId, author.id, db))) {
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setDescription('  You must be the voice owner or a manager to use this command.')
                .setColor('Red')
                .setTimestamp()
            ]
          });
        }

        try {
          await voiceChannel.permissionOverwrites.edit(targetMember, {
            Connect: true,
            Speak: true,
          });

          let relatedTextChannel = null;
          if (voiceChannel.parent) {
            relatedTextChannel = guild.channels.cache.find(
              c =>
                c.type === 0 &&
                c.parentId === voiceChannel.parentId &&
                c.name.toLowerCase().includes('interface')
            );
          }

          if (relatedTextChannel) {
            await relatedTextChannel.permissionOverwrites.edit(targetMember, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
            });
          }

          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setDescription(`<:arcadiatruee:1401752463144517652> Successfully permitted ${targetMember} to connect, speak, and send messages.`)
                .setColor('Green')
                .setTimestamp()
            ]
          });
        } catch (error) {
          console.error('Permission overwrite error:', error);
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setDescription('  Failed to update permissions. Make sure I have the necessary permissions.')
                .setColor('Red')
                .setTimestamp()
            ]
          });
        }
      }
    );

    // <:arcadiatruee:1401752463144517652> Use the correct shared manager table
    async function isManagerOf(ownerId, managerId, db) {
      return new Promise((resolve) => {
        db.get(
          `SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?`,
          [ownerId, managerId],
          (err, row) => {
            if (err) {
              console.error(err);
              return resolve(false);
            }
            resolve(!!row);
          }
        );
      });
    }
  },
};
