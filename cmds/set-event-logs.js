const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'set-event-logs',
  description: 'Sets the event log channel.',
  usage: '.set-event-logs <channel-id>',
  
  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   * @param {import('discord.js').Client} client
   * @param {import('sqlite3').Database} configDB
   */
  async execute(message, args, client, configDB) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('   You need to be an admin to set the event logs channel!');
    }

    const channelId = args[0];
    if (!channelId || isNaN(channelId)) {
      return message.reply('   Please provide a valid channel ID.');
    }

    const guildId = message.guild.id;

    try {
      // First check if a row already exists for the guild
      configDB.get(
        'SELECT 1 FROM event_manager WHERE guild_id = ?',
        [guildId],
        (err, row) => {
          if (err) {
            console.error('   DB Error:', err.message);
            return message.reply('   Database error occurred.');
          }

          const query = row
            ? 'UPDATE event_manager SET event_channel = ? WHERE guild_id = ?'
            : 'INSERT INTO event_manager (guild_id, event_channel) VALUES (?, ?)';

          const params = row
            ? [channelId, guildId]
            : [guildId, channelId];

          configDB.run(query, params, (err) => {
            if (err) {
              console.error('   Failed to save log channel:', err.message);
              return message.reply('   An error occurred while saving the event logs channel.');
            }

            const embed = new EmbedBuilder()
              .setTitle('<:arcadiatruee:1401752463144517652>  Event Logs Set')
              .setDescription(`The event logs channel has been set to <#${channelId}>.`)
              .setColor(0x1abc9c)
              .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
              .setTimestamp();

            message.reply({ embeds: [embed] });
          });
        }
      );
    } catch (err) {
      console.error('   Event Manager Error:', err.message);
      return message.reply('   An error occurred while setting the event logs channel.');
    }
  },
};
