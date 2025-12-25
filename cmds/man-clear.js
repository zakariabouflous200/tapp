const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
  name: 'man-clear',
  async execute(message, args, client, db) {
    // Create table if not exists (safety)
    db.run(`
      CREATE TABLE IF NOT EXISTS user_managers (
        owner_id TEXT,
        manager_id TEXT,
        PRIMARY KEY (owner_id, manager_id)
      )
    `, async (err) => {
      if (err) {
        console.error(err);
        return message.channel.send({
          embeds: [new EmbedBuilder().setDescription('  Database error occurred.')]
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_clear')
          .setLabel('Yes')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('cancel_clear')
          .setLabel('No')
          .setStyle(ButtonStyle.Secondary)
      );

      const confirmEmbed = new EmbedBuilder()
        .setDescription('⚠️ Are you sure you want to clear **your** manager list? This action **cannot** be undone.');

      const confirmationMessage = await message.channel.send({ embeds: [confirmEmbed], components: [row] });

      const filter = (interaction) => {
        return (
          (interaction.customId === 'confirm_clear' || interaction.customId === 'cancel_clear') &&
          interaction.user.id === message.author.id
        );
      };

      try {
        const interaction = await confirmationMessage.awaitMessageComponent({
          filter,
          componentType: ComponentType.Button,
          time: 15000
        });

        if (interaction.customId === 'confirm_clear') {
          db.run(`DELETE FROM user_managers WHERE owner_id = ?`, [message.author.id], function (err) {
            if (err) {
              console.error(err);
              interaction.update({
                embeds: [new EmbedBuilder().setDescription('  Failed to clear your managers due to database error.')],
                components: []
              });
              return;
            }

            interaction.update({
              embeds: [new EmbedBuilder().setDescription('<:arcadiatrue:1381421969055944707> All your managers have been cleared.')],
              components: []
            });
          });
        } else {
          interaction.update({
            embeds: [new EmbedBuilder().setDescription('❎ Manager clear canceled.')],
            components: []
          });
        }
      } catch {
        confirmationMessage.edit({
          embeds: [new EmbedBuilder().setDescription('⌛ Time expired. Manager clear canceled.')],
          components: []
        });
      }
    });
  }
};
