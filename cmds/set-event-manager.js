const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'set-event-manager',
  description: 'Sets the event manager role for the server.',
  usage: '.set-event-manager <role mention or ID>',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   * @param {import('discord.js').Client} client
   * @param {import('sqlite3').Database} configDB
   */
  async execute(message, args, client, configDB) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('   You need to be an admin to set the event manager!');
    }

    if (!args.length) {
      return message.reply('   Please mention a role or provide a valid role ID.');
    }

    // Accept both role mention or ID
    const input = args[0];
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(input);

    if (!role) {
      return message.reply('   Could not find a valid role by mention or ID.');
    }

    const guildId = message.guild.id;

    try {
      // First check if a row exists
      configDB.get(
        'SELECT 1 FROM event_manager WHERE guild_id = ?',
        [guildId],
        (err, row) => {
          if (err) {
            console.error('   DB Error:', err.message);
            return message.reply('   Database error occurred.');
          }

          const query = row
            ? 'UPDATE event_manager SET event_role = ? WHERE guild_id = ?'
            : 'INSERT INTO event_manager (event_role, guild_id) VALUES (?, ?)';

          const params = row
            ? [role.id, guildId]
            : [role.id, guildId];

          configDB.run(query, params, (err) => {
            if (err) {
              console.error('   Failed to set event manager role:', err.message);
              return message.reply('   An error occurred while saving the event manager role.');
            }

            const embed = new EmbedBuilder()
              .setTitle('<:arcadiatruee:1401752463144517652>  Event Manager Role Set')
              .setDescription(`The event manager role has been set to **${role.name}**.`)
              .setColor(0x1abc9c)
              .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
              .setTimestamp();

            message.reply({ embeds: [embed] });
          });
        }
      );
    } catch (err) {
      console.error('   Event Manager Error:', err.message);
      return message.reply('   An error occurred while setting the event manager role.');
    }
  },
};
