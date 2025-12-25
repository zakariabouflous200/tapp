const axios = require("axios");
const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: 'status',
  async execute(message, args, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    const statusMessage = args.join(' ').trim();
    if (!statusMessage) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription('   Please provide a status message.\nUsage: `status <your status>`')
        ]
      });
    }

    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription('   You must be connected to a voice channel to use this command.')
        ]
      });
    }

    // Check if the voice channel is a managed temp channel and get the owner
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
            embeds: [new EmbedBuilder().setDescription('   This voice channel is not managed by the bot or you are not allowed to set a status for it.')]
          });
        }

        const channelOwnerId = row.owner_id;

        if (channelOwnerId === userId) {
          return setVoiceStatus();
        }

        // Check if user is a manager of the channel owner
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
              return setVoiceStatus();
            }

            return message.channel.send({
              embeds: [new EmbedBuilder().setDescription('   You must be the voice channel owner or one of their managers to set the channel status.')]
            });
          }
        );

        async function setVoiceStatus() {
          const url = `https://discord.com/api/v10/channels/${voiceChannel.id}/voice-status`;
          const payload = { status: statusMessage };

          try {
            await axios.put(url, payload, {
              headers: {
                Authorization: `Bot ${client.token}`,
                'Content-Type': 'application/json'
              }
            });

            return message.channel.send({
              embeds: [
                new EmbedBuilder().setDescription(`<:arcadiatruee:1401752463144517652>  Voice status updated to: \`${statusMessage}\``)
              ]
            });
          } catch (err) {
            console.error("Failed to update voice status:", err?.response?.data || err.message);
            return message.channel.send({
              embeds: [
                new EmbedBuilder().setDescription(`   Failed to update voice status.`)
              ]
            });
          }
        }
      }
    );
  }
};
