const { EmbedBuilder, PermissionsBitField, OverwriteType } = require('discord.js');

module.exports = {
  name: 'info',
  description: 'Show voice channel info.',
  usage: '.v info',
  async execute(message, args, client, db) {
    console.log('✅ .v info triggered');

    const guild = message.guild;
    const member = message.member;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription('❌ You must be in a voice channel to use this command.')
            .setColor('Red')
            .setTimestamp()
        ]
      });
    }

    const guildId = guild.id;
    const voiceChannelId = voiceChannel.id;

    console.log(`🔍 Checking DB for channel ${voiceChannelId} in guild ${guildId}`);

    db.get(
      `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
      [voiceChannelId, guildId],
      async (err, row) => {
        if (err) {
          console.error('❌ DB error:', err);
          return message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setDescription('❌ Database error occurred.')
                .setColor('Red')
                .setTimestamp()
            ]
          });
        }

        let ownerMention = 'Not managed by bot';
        if (row) {
          try {
            const ownerMember = await guild.members.fetch(row.owner_id);
            ownerMention = ownerMember.toString();
          } catch (e) {
            console.warn('⚠️ Could not fetch owner:', e);
            ownerMention = `<@${row.owner_id}>`;
          }
        }

        const connectedMembers = voiceChannel.members.map(m => m.toString());

        // Get all users explicitly denied CONNECT in this voice channel
        const deniedMembers = [];
        for (const [id, overwrite] of voiceChannel.permissionOverwrites.cache) {
          if (
            overwrite.type === OverwriteType.Member &&
            overwrite.deny.has(PermissionsBitField.Flags.Connect)
          ) {
            try {
              const deniedMember = await guild.members.fetch(id);
              deniedMembers.push(deniedMember.toString());
            } catch (err) {
              console.warn(`⚠️ Could not fetch denied member (${id}):`, err.message);
              deniedMembers.push(`<@${id}>`);
            }
          }
        }

        const embed = new EmbedBuilder()
          .setTitle(`🔍 Info for: ${voiceChannel.name}`)
          .setColor('#2C2F33') // dark embed color
          .addFields(
            { name: '<:crown_drax:1391070112756531320> Owner', value: ownerMention, inline: true },
            { name: '📎 Channel ID', value: `\`${voiceChannelId}\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true }, // spacer to align next row properly
          
            {
              name: '<:true:1391089517783678986>  Members in voice',
              value: connectedMembers.length > 0 ? connectedMembers.join('\n') : '*None*',
              inline: true
            },
            {
              name: '<:false:1391089516432850984>  Rejected Members',
              value: deniedMembers.length > 0 ? deniedMembers.join('\n') : '*None*',
              inline: true
            },
            { name: '\u200B', value: '\u200B', inline: true } // optional: balance layout in case of odd fields
          )
          
          .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }
    );
  }
};
