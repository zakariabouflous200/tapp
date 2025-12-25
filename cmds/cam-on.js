const { PermissionsBitField, EmbedBuilder } = require("discord.js");

module.exports = {
  name: 'cam-on',
  description: 'Enable camera permission for everyone in the voice channel.',
  async execute(message, args, client, db) {
    const userId = message.author.id;
    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   You must be in a voice channel to use this command.')]
      });
    }

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
          return enableCamera();
        }

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
              return enableCamera();
            }

            return message.channel.send({
              embeds: [new EmbedBuilder().setDescription('   You must be the channel owner or a manager to enable camera.')]
            });
          }
        );

        async function enableCamera() {
          try {
            await voiceChannel.permissionOverwrites.edit(
                voiceChannel.guild.roles.everyone,
                { [PermissionsBitField.Flags.Stream]: true }
            );
              
              

            return message.channel.send({
              embeds: [
                new EmbedBuilder().setDescription('<:arcadiacamon:1401751735508144250>  > Enabled **Camera (Use Video)** permission for everyone in this voice channel.')
              ]
            });
          } catch (err) {
            console.error("Permission edit failed:", err);
            return message.channel.send({
              embeds: [new EmbedBuilder().setDescription('   Failed to update permissions.')]
            });
          }
        }
      }
    );
  }
};
