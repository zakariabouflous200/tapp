const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'tman-remove',
  description: 'Remove a manager role from task settings.',
  async execute(message, args, client, db) {
    // Check admin permission
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const embed = new EmbedBuilder()
        .setDescription('❌ You need Administrator permissions to use this command.')
        .setColor('#ff5555');
      return message.reply({ embeds: [embed] });
    }

    const guildId = message.guild.id;
    let role = message.mentions.roles.first();

    if (!role && args[0]) {
      try {
        role = await message.guild.roles.fetch(args[0]);
      } catch {
        const embed = new EmbedBuilder()
          .setDescription('❌ Invalid role ID or mention.')
          .setColor('#ff5555');
        return message.reply({ embeds: [embed] });
      }
    }

    if (!role) {
      const embed = new EmbedBuilder()
        .setDescription('❌ Please mention a role or provide a valid role ID.')
        .setColor('#ff5555');
      return message.reply({ embeds: [embed] });
    }

    // Fetch current managers
    db.get(`SELECT managers FROM task_settings WHERE guild_id = ?`, [guildId], (err, row) => {
      if (err) {
        console.error('DB error:', err);
        const embed = new EmbedBuilder()
          .setDescription('⚠️ Database error occurred.')
          .setColor('#ff9900');
        return message.reply({ embeds: [embed] });
      }

      if (!row?.managers) {
        const embed = new EmbedBuilder()
          .setDescription('⚠️ No manager roles are configured yet.')
          .setColor('#ff9900');
        return message.reply({ embeds: [embed] });
      }

      let currentManagers = row.managers.split(',');
      if (!currentManagers.includes(role.id)) {
        const embed = new EmbedBuilder()
          .setDescription('⚠️ This role is not listed as a manager.')
          .setColor('#ff9900');
        return message.reply({ embeds: [embed] });
      }

      // Remove role ID
      currentManagers = currentManagers.filter(id => id !== role.id);
      const updatedManagers = currentManagers.join(',');

      db.run(`
        UPDATE task_settings SET managers = ? WHERE guild_id = ?
      `, [updatedManagers, guildId], (err2) => {
        if (err2) {
          console.error('DB error on update:', err2);
          const embed = new EmbedBuilder()
            .setDescription('⚠️ Failed to update manager roles in the database.')
            .setColor('#ff9900');
          return message.reply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
          .setDescription(`✅ Role <@&${role.id}> has been removed from managers.`)
          .setColor('#57f287');
        message.reply({ embeds: [embed] });
      });
    });
  }
};
