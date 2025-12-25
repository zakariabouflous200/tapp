const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'taskconfig',
  description: 'Show current task settings (tasklogs, managers, taskers).',
  async execute(message, args, client, db) {
    const guildId = message.guild.id;

    db.get(`SELECT tasklogs, managers, taskers FROM task_settings WHERE guild_id = ?`, [guildId], (err, row) => {
      if (err) {
        console.error('DB error:', err);
        const embed = new EmbedBuilder()
          .setDescription('⚠️ Failed to retrieve task settings from the database.')
          .setColor('#ff9900');
        return message.reply({ embeds: [embed] });
      }

      if (!row) {
        const embed = new EmbedBuilder()
          .setDescription('⚠️ No task settings found for this server yet.')
          .setColor('#ff9900');
        return message.reply({ embeds: [embed] });
      }

      // Format roles and channels
      const tasklogChannel = row.tasklogs ? `<#${row.tasklogs}>` : 'Not Set';
      const managerRoles = row.managers
        ? row.managers.split(',').map(id => `<@&${id}>`).join(', ')
        : 'None';
      const taskerRoles = row.taskers
        ? row.taskers.split(',').map(id => `<@&${id}>`).join(', ')
        : 'None';

      const embed = new EmbedBuilder()
        .setDescription(`**📝 Task Configuration for \`${message.guild.name}\`**\n\n`
          + `**Task Log Channel:** ${tasklogChannel}\n`
          + `**👑 Managers:** ${managerRoles}\n`
          + `**👷 Taskers:** ${taskerRoles}`)
        .setColor('#2b2d31');

      message.reply({ embeds: [embed] });
    });
  }
};
