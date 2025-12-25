const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'event',
  description: 'Manage event-related tasks for the voice channel.',
  async execute(message, args, client, configDB, eventDB) {
    const userId = message.author.id;
    const guildId = message.guild.id;
    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription('   You must be connected to a voice channel to use this command.')
        ]
      });
    }

    // Step 1: Fetch event role, category, and log channel from DB
    configDB.get(
      'SELECT event_role, event_category, event_channel FROM event_manager WHERE guild_id = ?',
      [guildId],
      async (err, row) => {
        if (err) {
          console.error(err);
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   Database error occurred while fetching event data.')]
          });
        }

        if (!row) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   No event data found for this server.')]
          });
        }

        const eventRole = String(row.event_role); // Ensure it's treated as a string
        const eventCategoryId = row.event_category;
        const eventLogChannelId = row.event_channel;

        if (!eventCategoryId || isNaN(eventCategoryId)) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   Invalid event category ID in the database.')]
          });
        }

        try {
          // Step 2: Get voice channel owner from temp_channels
          const tempChannelRow = await new Promise((resolve, reject) => {
            configDB.get(
              'SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?',
              [voiceChannel.id, guildId],
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          });

          const channelOwnerId = tempChannelRow?.owner_id;
          const isOwner = channelOwnerId === userId;
          const isEventManager = member.roles.cache.has(eventRole);
          const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

          if (!isOwner || (!isEventManager && !isAdmin)) {
            return message.channel.send({
              embeds: [
                new EmbedBuilder().setDescription('   You must be the voice channel owner **and** either an event manager or have admin permissions.')
              ]
            });
          }

          // Step 3: Fetch and validate event category
          const eventCategory = await message.guild.channels.fetch(eventCategoryId);
          if (!eventCategory || eventCategory.type !== 4) {
            console.error(`   Invalid category type: ${eventCategory?.type}`);
            return message.channel.send({
              embeds: [new EmbedBuilder().setDescription('   Invalid or missing event category.')]
            });
          }

          // Step 4: Move channel & update permissions
          await voiceChannel.setParent(eventCategoryId);
          await voiceChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
            Speak: false
          });

          const embed = new EmbedBuilder()
            .setTitle('<:arcadiatruee:1401752463144517652>  Event Channel Updated')
            .setDescription('The voice channel has been moved to the event category and speak permissions have been disabled.')
            .addFields(
              { name: 'Event Category', value: eventCategory.name },
              { name: 'Speak Permissions', value: 'Disabled for everyone' }
            )
            .setColor(0x1abc9c)
            .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

          await message.channel.send({ embeds: [embed] });

          // Step 5: Send event summary to logs channel
          if (eventLogChannelId) {
            const logChannel = await message.guild.channels.fetch(eventLogChannelId).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
              const voiceMembers = [...voiceChannel.members.values()];
              const memberNames = voiceMembers.map(m => m.displayName).join('\n') || 'No members';
              const memberCount = voiceMembers.length;

              // Filter for event managers in voice channel
              const eventManagersInVC = voiceMembers.filter(m => m.roles.cache.has(eventRole));
              const hostMentions = eventManagersInVC.length > 0
                ? eventManagersInVC.map(m => `<@${m.id}>`).join(', ')
                : 'None';

              const logEmbed = new EmbedBuilder()
                .setTitle('📢 Event Started')
                .setDescription(`An event has been started in **${voiceChannel.name}**.`)
                .addFields(
                  { name: 'Hosters (Event Managers)', value: hostMentions, inline: true },
                  { name: 'Participants', value: memberNames },
                  { name: 'Total Members', value: `${memberCount}`, inline: true }
                )
                .setColor(0xf1c40f)
                .setTimestamp();

              await logChannel.send({ embeds: [logEmbed] });
            }
          }

        } catch (error) {
          console.error('Failed to update event:', error.message);
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   Failed to update the event channel.')]
          });
        }
      }
    );
  }
};
