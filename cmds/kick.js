const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'kick',
  description: 'Kick a user from your temporary voice channel by disconnecting them.',
  usage: '.v kick <user>',
  aliases: ['vc-kick', 'disconnect'],
  async execute(message, args, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (!args[0]) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   Please provide a user mention or ID to kick.')]
      });
    }

    const targetMember = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!targetMember) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   Target user not found in this server.')]
      });
    }

    // Protected user IDs (cannot be kicked)
const protectedIds = ['1202396567093387327', '408979183356739604'];

if (protectedIds.includes(targetMember.id)) {
  return message.channel.send({
    embeds: [new EmbedBuilder().setDescription('   You can’t kick the developer.')]
  });
}


    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   You must be connected to a voice channel to use this command.')]
      });
    }

    try {
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
          embeds: [new EmbedBuilder().setDescription('   This voice channel is not managed by the bot or you are not allowed to kick users here.')]
        });
      }

      const channelOwnerId = tempChannelRow.owner_id;

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
          embeds: [new EmbedBuilder().setDescription('   You must be the voice channel owner or a manager to kick users.')]
        });
      }

      if (targetMember.id === userId) {
        return message.channel.send({
          embeds: [new EmbedBuilder().setDescription('   You cannot kick yourself.')]
        });
      }

      if (!isOwner && targetMember.id === channelOwnerId) {
        return message.channel.send({
          embeds: [new EmbedBuilder().setDescription('   Managers cannot kick the channel owner.')]
        });
      }

      if (!isOwner && managers.includes(targetMember.id)) {
        return message.channel.send({
          embeds: [new EmbedBuilder().setDescription('   Managers cannot kick other managers.')]
        });
      }

      // Only disconnect the target if they are in the same voice channel
      if (targetMember.voice.channelId === voiceChannel.id) {
        await targetMember.voice.disconnect('Kicked from the temporary voice channel.');
        return message.channel.send({
          embeds: [new EmbedBuilder().setDescription(`<:arcadiatruee:1401752463144517652>  Successfully kicked ${targetMember.user.tag} from the voice channel.`)]
        });
      } else {
        return message.channel.send({
          embeds: [new EmbedBuilder().setDescription('   The user is not connected to your voice channel.')]
        });
      }

    } catch (error) {
      console.error('Error in kick command:', error);
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   Failed to kick user due to an error.')]
      });
    }
  }
};
