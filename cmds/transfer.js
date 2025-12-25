const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
  name: 'transfer',
  description: 'Transfer ownership of your temporary voice channel to another user in the same channel.',
  usage: '.v transfer @user / ID ',
  async execute(message, args, client, db) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    const member = message.guild.members.cache.get(userId);
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setDescription('   You must be connected to a voice channel to use this command.')]
      });
    }

    db.get(
      `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
      [voiceChannel.id, guildId],
      async (err, row) => {
        if (err) {
          console.error(err);
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   Database error occurred.')]
          });
        }

        if (!row) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   This voice channel is not managed by the bot.')]
          });
        }

        const currentOwnerId = row.owner_id;

        if (currentOwnerId !== userId) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   You are not the owner of this voice channel.')]
          });
        }

        if (!args[0]) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   Please mention the user to transfer ownership to.')]
          });
        }

        let targetMember = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

        if (!targetMember) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   User not found in this server.')]
          });
        }

        if (!targetMember.voice.channel || targetMember.voice.channel.id !== voiceChannel.id) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('   The user must be connected to the same voice channel.')]
          });
        }

        // Send confirmation message
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_transfer')
            .setLabel('Yes')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('cancel_transfer')
            .setLabel('No')
            .setStyle(ButtonStyle.Secondary)
        );

        const confirmMessage = await message.channel.send({
          embeds: [
            new EmbedBuilder().setDescription(`⚠️ Are you sure you want to transfer ownership to **${targetMember.user.tag}**?`)
          ],
          components: [confirmRow]
        });

        // Create collector
        const collector = confirmMessage.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 15_000,
          max: 1
        });

        collector.on('collect', interaction => {
          if (interaction.user.id !== userId) {
            return interaction.reply({ content: '   Only the command author can confirm this action.', ephemeral: true });
          }

          if (interaction.customId === 'confirm_transfer') {
            // Update database
            db.run(
              `UPDATE temp_channels SET owner_id = ? WHERE channel_id = ? AND guild_id = ?`,
              [targetMember.id, voiceChannel.id, guildId],
              (updateErr) => {
                if (updateErr) {
                  console.error(updateErr);
                  return interaction.update({
                    embeds: [new EmbedBuilder().setDescription('   Failed to transfer ownership due to a database error.')],
                    components: []
                  });
                }

                interaction.update({
                  embeds: [new EmbedBuilder().setDescription(`<:arcadiatruee:1401752463144517652>  Ownership transferred to **${targetMember.user.tag}**.`)],
                  components: []
                });
              }
            );
          } else if (interaction.customId === 'cancel_transfer') {
            interaction.update({
              embeds: [new EmbedBuilder().setDescription('   Transfer cancelled.')],
              components: []
            });
          }
        });

        collector.on('end', (collected) => {
          if (collected.size === 0) {
            confirmMessage.edit({
              embeds: [new EmbedBuilder().setDescription('⏰ No response received. Ownership transfer cancelled.')],
              components: []
            });
          }
        });
      }
    );
  }
};
