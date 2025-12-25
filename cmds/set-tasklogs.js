const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'set-tasklogs',
  description: 'Set the channel where task logs will be sent.',
  async execute(message, args, client, db) {
    // Admin check
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const noPermEmbed = new EmbedBuilder()
        .setDescription('❌ You need Administrator permissions to use this command.')
        .setColor('#ff5555');
      return message.reply({ embeds: [noPermEmbed] });
    }

    const guildId = message.guild.id;
    let channel = message.mentions.channels.first();

    if (!channel && args[0]) {
      try {
        channel = await message.guild.channels.fetch(args[0]);
      } catch {
        const invalidEmbed = new EmbedBuilder()
          .setDescription('❌ Invalid channel ID or mention.')
          .setColor('#ff5555');
        return message.reply({ embeds: [invalidEmbed] });
      }
    }

    if (!channel) {
      const missingEmbed = new EmbedBuilder()
        .setDescription('❌ Please mention a channel or provide its ID.')
        .setColor('#ff5555');
      return message.reply({ embeds: [missingEmbed] });
    }

    // Save to DB
    db.run(`
      INSERT INTO task_settings (guild_id, tasklogs)
      VALUES (?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET tasklogs = excluded.tasklogs
    `, [guildId, channel.id], (err) => {
      if (err) {
        console.error('DB error:', err);
        const errorEmbed = new EmbedBuilder()
          .setDescription('⚠️ Something went wrong while saving to the database.')
          .setColor('#ff9900');
        return message.reply({ embeds: [errorEmbed] });
      }

      const successEmbed = new EmbedBuilder()
        .setDescription(`✅ Task log channel has been set to <#${channel.id}>.`)
        .setColor('#57f287');
      message.reply({ embeds: [successEmbed] });
    });
  }
};
