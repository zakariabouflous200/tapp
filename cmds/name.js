const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'name',
  async execute(message, args, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (!args.length) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   Please provide the new voice channel name.\nUsage: `.v name <new name>`')]
      });
    }

    const newName = args.join(' ').trim();
    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   You must be connected to a voice channel to use this command.')]
      });
    }

    db.get(
      `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
      [voiceChannel.id, guildId],
      (err, row) => {
        if (err) {
          console.error(err);
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   Database error occurred.')]
          });
        }

        if (!row) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   This voice channel is not managed by the bot or you are not allowed to rename it.')]
          });
        }

        const channelOwnerId = row.owner_id;

        if (channelOwnerId === userId) {
          return renameVoiceChannel();
        }

        // Check if user is a manager of the channel owner using the same `db`
        db.get(
          `SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?`,
          [channelOwnerId, userId],
          (err2, managerRow) => {
            if (err2) {
              console.error(err2);
              return message.channel.send({
                embeds: [new EmbedBuilder().setDescription('   Manager DB query error occurred.')]
              });
            }

            if (managerRow) {
              return renameVoiceChannel();
            }

            return message.channel.send({
              embeds: [new EmbedBuilder().setDescription('   You must be the voice channel owner or one of their managers to rename this channel.')]
            });
          }
        );

        function renameVoiceChannel() {
          voiceChannel.edit({ name: newName }).then(() => {
            message.channel.send({
              embeds: [new EmbedBuilder().setDescription(`<:arcadiatruee:1401752463144517652>  Voice channel renamed to \`${newName}\`.`)]
            });
          }).catch(error => {
            console.error(error);
            message.channel.send({
              embeds: [new EmbedBuilder().setDescription('   Failed to rename the voice channel. Make sure I have permission to manage channels.')]
            });
          });
        }
      }
    );
  }
};
