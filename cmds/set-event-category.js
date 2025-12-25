const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'set-event-category',
  description: 'Sets the category ID for the event channel.',
  usage: '.set-event-category <category-id>',
  
  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   * @param {import('discord.js').Client} client
   * @param {import('sqlite3').Database} configDB
   */
  async execute(message, args, client, configDB) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.reply('   You need to be an admin to set the event category!');
    }

    const categoryId = args[0];
    if (!categoryId) {
      return message.reply('   You need to specify a category ID.');
    }

    const guildId = message.guild.id;
    const eventName = 'Default Event'; // Modify as needed

    try {
      // Insert or update the event category in the database using dbRun
      await configDB.run(
        `INSERT OR REPLACE INTO event_manager (guild_id, event_name, event_category) 
         VALUES (?, ?, ?)`,
        [guildId, eventName, categoryId]
      );

      // Build and send the success embed
      const embed = new EmbedBuilder()
        .setTitle('<:arcadiatruee:1401752463144517652>  Event Category Set')
        .setDescription(`The event category has been successfully set to <#${categoryId}>.`)
        .setColor(0x1abc9c)
        .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      message.reply({ embeds: [embed] });
    } catch (err) {
      console.error('   Event Manager Error:', err.message);
      return message.reply('   An error occurred while setting the event category.');
    }
  },
};
