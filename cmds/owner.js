const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'owner',
  description: 'Show the current owner of your temporary voice channel.',
  async execute(message, args, client, db) {
    const guildId = message.guild.id;

    // Check if user is in a voice channel
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription('   You must be connected to a voice channel to use this command.')
            .setColor('Red')
            .setTimestamp()
        ]
      });
    }

    // Check if the voice channel is managed by the bot
    db.get(
      `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
      [voiceChannel.id, guildId],
      (err, row) => {
        if (err) {
          console.error(err);
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setDescription('   A database error occurred. Please try again later.')
                .setColor('Red')
                .setTimestamp()
            ]
          });
        }

        if (!row) {
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setDescription('   This voice channel is not managed by the bot.')
                .setColor('Orange')
                .setTimestamp()
            ]
          });
        }

        const ownerId = row.owner_id;
        const ownerMember = message.guild.members.cache.get(ownerId);

        if (!ownerMember) {
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setDescription('⚠️ The owner of this voice channel is no longer in the server.')
                .setColor('Yellow')
                .setTimestamp()
            ]
          });
        }

        message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor('Blue')
              .setDescription(`🎤 **Voice Channel Owner:** <@${ownerMember.id}>`)
              .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
              .setTimestamp()
          ]
        });
      }
    );
  },
};
