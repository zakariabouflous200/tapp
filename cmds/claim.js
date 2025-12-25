const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'claim',
  description: 'Claim ownership of a temporary voice channel if the current owner is not present, or force claim if you are whitelisted.',
  async execute(message, args, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const voiceChannel = message.member.voice.channel;

    // Whitelisted users who can force claim
    const forceClaimIds = ['408979183356739604', '1202396567093387327'];

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription('   You must be connected to a voice channel to use this command.')
        ]
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
            embeds: [new EmbedBuilder().setDescription('   This voice channel is not managed by the bot.')]
          });
        }

        const currentOwnerId = row.owner_id;

        if (currentOwnerId === userId) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('ℹ️ You are already the owner of this voice channel.')]
          });
        }

        // If not whitelisted, check if current owner is still in the channel
        if (!forceClaimIds.includes(userId)) {
          const currentOwnerMember = message.guild.members.cache.get(currentOwnerId);
          if (
            currentOwnerMember &&
            currentOwnerMember.voice.channel &&
            currentOwnerMember.voice.channel.id === voiceChannel.id
          ) {
            return message.channel.send({
              embeds: [new EmbedBuilder().setDescription('   The current owner is still connected to this voice channel. You cannot claim it.')]
            });
          }
        }

        // Allow claim
        db.run(
          `UPDATE temp_channels SET owner_id = ? WHERE channel_id = ? AND guild_id = ?`,
          [userId, voiceChannel.id, guildId],
          (updateErr) => {
            if (updateErr) {
              console.error(updateErr);
              return message.channel.send({
                embeds: [new EmbedBuilder().setDescription('   Failed to claim ownership due to a database error.')]
              });
            }

            message.channel.send({
              embeds: [new EmbedBuilder().setDescription('<:arcadiatruee:1401752463144517652>  You have claimed ownership of this voice channel.')]
            });
          }
        );
      }
    );
  },
};
