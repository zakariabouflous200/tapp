const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client, configDB, taskDB) {
    if (!interaction.isButton()) return;
    const { customId, guild, member } = interaction;
    if (!guild) return;

    if (customId !== 'task_accept' && customId !== 'task_deny') return;

    // Permission check
    const taskSettings = await new Promise((resolve, reject) => {
      configDB.get(
        `SELECT taskers, managers FROM task_settings WHERE guild_id = ?`,
        [guild.id],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    }).catch(() => null);

    if (!taskSettings) {
      if (!interaction.replied) await interaction.reply({ content: 'Task settings not configured.', ephemeral: true });
      return;
    }

    const managersIds = (taskSettings.managers || '').split(',').filter(Boolean);

    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
    const isManager = managersIds.includes(member.id);

    if (!isAdmin && !isManager) {
      if (!interaction.replied) await interaction.reply({ content: 'You do not have permission to use this button.', ephemeral: true });
      return;
    }

    const embed = interaction.message.embeds[0];
    if (!embed) {
      if (!interaction.replied) await interaction.reply({ content: 'Embed data missing.', ephemeral: true });
      return;
    }

    const taskerField = embed.fields.find(f => f.name.toLowerCase() === 'tasker');
    if (!taskerField) {
      if (!interaction.replied) await interaction.reply({ content: 'Cannot find Tasker field in embed.', ephemeral: true });
      return;
    }

    const mentionMatch = taskerField.value.match(/<@!?(\d+)>/);
    if (!mentionMatch) {
      if (!interaction.replied) await interaction.reply({ content: 'Cannot parse Tasker ID from embed.', ephemeral: true });
      return;
    }

    const taskerId = mentionMatch[1];

    try {
      if (customId === 'task_accept') {
        if (!taskDB) throw new Error('taskDB is undefined');

        await new Promise((resolve, reject) => {
          taskDB.run(
            `INSERT INTO task_counts (server_id, tasker_id, number_of_tasks)
             VALUES (?, ?, 1)
             ON CONFLICT(server_id, tasker_id) DO UPDATE SET number_of_tasks = number_of_tasks + 1`,
            [guild.id, taskerId],
            (err) => (err ? reject(err) : resolve())
          );
        });

        if (!interaction.replied) await interaction.reply({ content: `✅ Task accepted and recorded for <@${taskerId}>.`, ephemeral: true });
      } else if (customId === 'task_deny') {
        if (!interaction.replied) await interaction.reply({ content: '❌ Task denied, no changes made.', ephemeral: true });
      }

      // Remove buttons regardless of accept or deny
      await interaction.message.edit({ components: [] });
    } catch (error) {
      console.error('Error processing button interaction:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ There was an error processing this interaction.', ephemeral: true });
      }
    }
  }
};
