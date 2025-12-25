const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  name: 'tasker-add',
  description: 'Add a tasker role to task settings.',
  async execute(message, args, client, db) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setDescription('❌ You need Administrator permissions to use this command.')
          .setColor('#ff5555')]
      });
    }

    const guildId = message.guild.id;
    let role = message.mentions.roles.first();

    if (!role && args[0]) {
      try {
        role = await message.guild.roles.fetch(args[0]);
      } catch {
        return message.reply({
          embeds: [new EmbedBuilder()
            .setDescription('❌ Invalid role ID or mention.')
            .setColor('#ff5555')]
        });
      }
    }

    if (!role) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setDescription('❌ Please mention a role or provide a valid role ID.')
          .setColor('#ff5555')]
      });
    }

    db.get(`SELECT taskers FROM task_settings WHERE guild_id = ?`, [guildId], (err, row) => {
      if (err) {
        console.error(err);
        return message.reply({
          embeds: [new EmbedBuilder()
            .setDescription('⚠️ Database error occurred.')
            .setColor('#ff9900')]
        });
      }

      let currentTaskers = row?.taskers ? row.taskers.split(',') : [];
      if (currentTaskers.includes(role.id)) {
        return message.reply({
          embeds: [new EmbedBuilder()
            .setDescription('⚠️ This role is already a tasker.')
            .setColor('#ff9900')]
        });
      }

      currentTaskers.push(role.id);
      const updated = currentTaskers.join(',');

      db.run(`
        INSERT INTO task_settings (guild_id, taskers)
        VALUES (?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET taskers = excluded.taskers
      `, [guildId, updated], (err2) => {
        if (err2) {
          console.error(err2);
          return message.reply({
            embeds: [new EmbedBuilder()
              .setDescription('⚠️ Failed to update tasker roles in the database.')
              .setColor('#ff9900')]
          });
        }

        message.reply({
          embeds: [new EmbedBuilder()
            .setDescription(`✅ Role <@&${role.id}> has been added as a tasker.`)
            .setColor('#57f287')]
        });
      });
    });
  }
};
