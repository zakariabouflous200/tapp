const { PermissionsBitField, EmbedBuilder } = require("discord.js");

module.exports = {
  name: 'sb-off',
  description: 'Disable soundboard permission for everyone in the voice channel.',
  async execute(message, args, client, db) {
    const userId = message.author.id;
    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   You must be in a voice channel to use this command.')]
      });
    }

    // Check if member is the channel owner or their manager
    db.get(
      `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
      [voiceChannel.id, message.guild.id],
      (err, row) => {
        if (err) {
          console.error(err);
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   Database error occurred.')]
          });
        }

        if (!row) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   This voice channel is not managed by the bot or you are not allowed to modify it.')]
          });
        }

        const channelOwnerId = row.owner_id;

        if (channelOwnerId === userId) {
          return disableSoundboard();
        }

        // Check manager permissions
        db.get(
          `SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?`,
          [channelOwnerId, userId],
          (err2, managerRow) => {
            if (err2) {
              console.error(err2);
              return message.channel.send({
                embeds: [new EmbedBuilder().setDescription('   Manager DB error occurred.')]
              });
            }

            if (managerRow) {
              return disableSoundboard();
            }

            return message.channel.send({
              embeds: [new EmbedBuilder().setDescription('   You must be the channel owner or a manager to disable soundboard.')]
            });
          }
        );

        async function disableSoundboard() {
          try {
            await voiceChannel.permissionOverwrites.edit(voiceChannel.guild.roles.everyone, {
              [PermissionsBitField.Flags.UseSoundboard]: false,
            });

            return message.channel.send({
              embeds: [
                new EmbedBuilder().setDescription('<:arcadiasboff:1401751570508419223>   Disabled **Use Soundboard** permission for everyone in this voice channel.')
              ]
            });
          } catch (err) {
            console.error("Permission edit failed:", err);
            return message.channel.send({
              embeds: [
                new EmbedBuilder().setDescription('   Failed to update permissions.')
              ]
            });
          }
        }
      }
    );
  }
};
