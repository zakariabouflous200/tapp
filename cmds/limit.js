const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'limit',
  description: 'Set a user limit on your temporary voice channel (0 to 99).',
  usage: 'vlimit <number>',
  async execute(message, args, client, db) {
    const userId = message.author.id;
    const guild = message.guild;
    const guildId = guild.id;

    const member = guild.members.cache.get(userId);
    const voiceChannel = member?.voice.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription('   You must be connected to a voice channel to use this command.')
        ]
      });
    }

    // Parse the limit
    const limit = parseInt(args[0], 10);
    if (isNaN(limit) || limit < 0 || limit > 99) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription('   Please provide a valid user limit between 0 and 99.')
        ]
      });
    }

    try {
      // Get channel owner from DB
      const tempChannelRow = await new Promise((resolve, reject) => {
        db.get(
          `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
          [voiceChannel.id, guildId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!tempChannelRow) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder().setDescription('   This voice channel is not managed by the bot or you are not allowed to modify it.')
          ]
        });
      }

      const channelOwnerId = tempChannelRow.owner_id;

      // Get managers from DB
      const managerRows = await new Promise((resolve, reject) => {
        db.all(
          `SELECT manager_id FROM user_managers WHERE owner_id = ?`,
          [channelOwnerId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      const managers = managerRows.map(r => r.manager_id);

      const isOwner = channelOwnerId === userId;
      const isManager = managers.includes(userId);

      if (!isOwner && !isManager) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder().setDescription('   You must be the voice channel owner or a manager to set the limit.')
          ]
        });
      }

      // Apply the limit
      await voiceChannel.setUserLimit(limit);

      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription(`<:arcadiatruee:1401752463144517652>  User limit set to \`${limit}\` for the voice channel.`)
        ]
      });

    } catch (error) {
      console.error('Error setting user limit:', error);
      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription('   Failed to set the user limit. Make sure I have the correct permissions.')
        ]
      });
    }
  }
};
