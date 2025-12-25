const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'deny',
  description: 'Deny a user from your temporary voice channel and move them to setup room if connected.',
  usage: '.v deny <user>',
  aliases: ['reject'],
  async execute(message, args, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (!args[0]) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   Please provide a user mention or ID to deny access.')]
      });
    }

    // Resolve the target member by mention or ID
    const targetMember = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    if (!targetMember) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   Target user not found in this server.')]
      });
    }

    // Prevent denying the developer
    // Protected user IDs (cannot be kicked)
const protectedIds = ['1202396567093387327', '408979183356739604'];

if (protectedIds.includes(targetMember.id)) {
  return message.channel.send({
    embeds: [new EmbedBuilder().setDescription('   You can’t kick the developer.')]
  });
}


    // Get the command user's current voice channel
    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   You must be connected to a voice channel to use this command.')]
      });
    }

    try {
      // Check if the voice channel is managed by the bot and get the owner
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
          embeds: [new EmbedBuilder().setDescription('   This voice channel is not managed by the bot or you are not allowed to deny users here.')]
        });
      }

      const channelOwnerId = tempChannelRow.owner_id;

      // Get all managers of the channel owner
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

      // Check if the command user is owner or a manager
      const isOwner = channelOwnerId === userId;
      const isManager = managers.includes(userId);

      if (!isOwner && !isManager) {
        return message.channel.send({
          embeds: [new EmbedBuilder().setDescription('   You must be the voice channel owner or a manager to deny users.')]
        });
      }

      // Prevent denying yourself
      if (targetMember.id === userId) {
        return message.channel.send({
          embeds: [new EmbedBuilder().setDescription('   You cannot deny yourself.')]
        });
      }

      // Prevent managers denying owner
      if (!isOwner && targetMember.id === channelOwnerId) {
        return message.channel.send({
          embeds: [new EmbedBuilder().setDescription('   Managers cannot deny the channel owner.')]
        });
      }

      // Prevent managers denying other managers
      if (!isOwner && managers.includes(targetMember.id)) {
        return message.channel.send({
          embeds: [new EmbedBuilder().setDescription('   Managers cannot deny other managers.')]
        });
      }

      // Remove permission overwrites for the target user on the voice channel (deny connect, speak, view)
      await voiceChannel.permissionOverwrites.edit(targetMember.id, {
        Connect: false,
        Speak: true,
        ViewChannel: true,
      });

      // If target is connected to that voice channel, move them to setup room if configured
      if (targetMember.voice.channelId === voiceChannel.id) {
        const configRow = await new Promise((resolve, reject) => {
          db.get(`SELECT room_id FROM guild_config WHERE guild_id = ?`, [guildId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (configRow && configRow.room_id) {
          const setupRoom = message.guild.channels.cache.get(configRow.room_id);
          if (setupRoom) {
            await targetMember.voice.setChannel(setupRoom);
          }
        }
      }

      // Confirmation message
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription(`<:arcadiatruee:1401752463144517652>  Successfully denied access for ${targetMember.user.tag}.`)]
      });

    } catch (error) {
      console.error('Error in deny command:', error);
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   Failed to deny user permissions due to an error.')]
      });
    }
  }
};
