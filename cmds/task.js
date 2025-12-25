const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'task',
  description: 'Task command usable by voice owner + admin/tasker, sends embed with buttons to tasklogs channel.',
  async execute(message, args, client, db) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setDescription('   You must be in a voice channel to use this command.')
          .setColor('#ff5555')]
      });
    }

    // Get owner of voice channel
    const tempChannelRow = await new Promise((resolve, reject) => {
      db.get(`SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
        [voiceChannel.id, guildId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
    });

    if (!tempChannelRow) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setDescription('   This voice channel is not managed by the bot.')
          .setColor('#ff9900')]
      });
    }

    if (tempChannelRow.owner_id !== userId) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setDescription('   You must be the voice channel owner to use this command.')
          .setColor('#ff5555')]
      });
    }

    // Check if user is admin or has a tasker role
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

    const taskSettingsRow = await new Promise((resolve, reject) => {
      db.get(`SELECT tasklogs, taskers FROM task_settings WHERE guild_id = ?`, [guildId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!taskSettingsRow?.tasklogs) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setDescription('⚠️ Tasklogs channel is not set. Use `.v set-tasklogs` to configure it.')
          .setColor('#ff9900')]
      });
    }

    const taskerRoleIds = taskSettingsRow.taskers ? taskSettingsRow.taskers.split(',') : [];
    const isTasker = taskerRoleIds.some(roleId => member.roles.cache.has(roleId));

    if (!(isAdmin || isTasker)) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setDescription('   You need to be an admin or have a tasker role to use this command.')
          .setColor('#ff5555')]
      });
    }

    // Collect members in voice channel
    const voiceMembers = voiceChannel.members;

    // Separate other taskers (exclude command user)
    const otherTaskers = voiceMembers.filter(m =>
      m.id !== userId && taskerRoleIds.some(roleId => m.roles.cache.has(roleId))
    );

    // Remaining members (not tasker and not command user)
    const remainingMembers = voiceMembers.filter(m =>
      m.id !== userId && !taskerRoleIds.some(roleId => m.roles.cache.has(roleId))
    );

    // Compose embed for tasklogs channel
    const embed = new EmbedBuilder()
      .setTitle('🎯 Task Report')
      .setColor('#2b2d31')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Tasker', value: `<@${userId}>`, inline: true },
        { name: 'Other Taskers', value: otherTaskers.size > 0 ? otherTaskers.map(m => `<@${m.id}>`).join(', ') : 'None', inline: true },
        { name: 'In Voice', value: remainingMembers.size > 0 ? remainingMembers.map(m => `<@${m.id}>`).join(', ') : 'None', inline: false },
      )
      .setFooter({ text: `Guild: ${message.guild.name} | Channel: ${voiceChannel.name}` })
      .setTimestamp();

    // Create buttons
    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('task_accept')
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('task_deny')
          .setLabel('Deny')
          .setStyle(ButtonStyle.Danger)
      );

    // Fetch tasklogs channel
    const tasklogsChannel = message.guild.channels.cache.get(taskSettingsRow.tasklogs);
    if (!tasklogsChannel) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setDescription('⚠️ Tasklogs channel configured does not exist or I cannot access it.')
          .setColor('#ff9900')]
      });
    }

    try {
      await tasklogsChannel.send({ embeds: [embed], components: [buttons] });

      // Confirm to command user
      await message.reply({
        embeds: [new EmbedBuilder()
          .setDescription('✅ Task successfully sent to tasklogs channel.')
          .setColor('#57f287')]
      });
    } catch (error) {
      console.error('Error sending tasklog embed:', error);
      message.channel.send({
        embeds: [new EmbedBuilder()
          .setDescription('⚠️ Failed to send task report to the tasklogs channel.')
          .setColor('#ff5555')]
      });
    }
  }
};
