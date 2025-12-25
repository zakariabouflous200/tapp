const { EmbedBuilder } = require('discord.js');
const { promisify } = require('util');

module.exports = {
  name: 'top',
  description: 'Shows the top users by voice time in this server',
  usage: '.vtop',

  /**
   * @param {import('discord.js').Message} message
   * @param {string[]} args
   * @param {import('discord.js').Client} client
   * @param {import('sqlite3').Database} configDB
   * @param {import('sqlite3').Database} totoDB
   */
  async execute(message, args, client, configDB, totoDB) {
    if (!totoDB || typeof totoDB.all !== 'function') {
      return message.channel.send('   Database connection is not properly initialized.');
    }

    try {
      // Promisify totoDB.all for async/await usage
      const dbAll = promisify(totoDB.all).bind(totoDB);

      // Get the guild ID
      const guildId = message.guild?.id;
      if (!guildId) return message.channel.send('   This command must be used in a server.');

      // Query top 10 users by time_for_user in this guild
      const rows = await dbAll(
        `SELECT user_id, time_for_user FROM user_time_data WHERE guild_id = ? ORDER BY time_for_user DESC LIMIT 10`,
        [guildId]
      );

      if (!rows || rows.length === 0) {
        return message.channel.send('ℹ️ No voice time data found for this server.');
      }

      // Format the results into a leaderboard string
      const leaderboard = await Promise.all(
        rows.map(async (row, index) => {
          let userTag = `<@${row.user_id}>`;
          try {
            // Try to fetch user for accurate tag or username fallback
            const user = await client.users.fetch(row.user_id);
            if (user) userTag = `${user.tag}`;
          } catch {
            // ignore fetch error, keep mention fallback
          }

          // Format time in hours, minutes, seconds
          const seconds = row.time_for_user;
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;

          const timeStr = `${hours}h ${minutes}m ${secs}s`;

          return `**#${index + 1}** — ${userTag}: \`${timeStr}\``;
        })
      );

      // Build and send embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 Top 10 Voice Time Members in ${message.guild.name}`)
        .setDescription(leaderboard.join('\n'))
        .setColor(0x1abc9c)
        .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error fetching top users:', error);
      message.channel.send('   An error occurred while fetching the leaderboard.');
    }
  },
};
