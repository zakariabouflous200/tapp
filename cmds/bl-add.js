const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'bl-add',
  description: 'Add a user to your blacklist',
  usage: '.bl-add @user / ID',
  async execute(message, args, client, db) {
    if (!args[0]) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000')
          .setDescription('   Please mention a user or provide their ID to blacklist.')]
      });
    }

    // helper: mention or numeric ID
    const extractId = (arg) => {
      if (!arg) return null;
      const mentionMatch = arg.match(/^<@!?(\d{17,20})>$/);
      if (mentionMatch) return mentionMatch[1];
      if (/^\d{17,20}$/.test(arg)) return arg;
      return null;
    };

    const targetId = extractId(args[0]);
    if (!targetId) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000')
          .setDescription('   Invalid user mention or ID.')]
      });
    }

    let userToAdd;
    try {
      userToAdd = await client.users.fetch(targetId, { force: true });
    } catch {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000')
          .setDescription('   Could not find that user.')]
      });
    }

    if (userToAdd.id === message.author.id) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000')
          .setDescription('   You cannot blacklist yourself.')]
      });
    }

    const ownerId = message.author.id;
    const guildId = message.guild.id;
    const blacklistedId = userToAdd.id;

    // Check whitelist first
    db.get(
      `SELECT * FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?`,
      [ownerId, blacklistedId, guildId],
      (err, whitelistRow) => {
        if (err) {
          console.error('Database error:', err);
          return message.reply({
            embeds: [new EmbedBuilder().setColor('000000')
              .setDescription('   Database error occurred.')]
          });
        }

        if (whitelistRow) {
          return message.reply({
            embeds: [new EmbedBuilder().setColor('000000')
              .setDescription('   This user is whitelisted. Remove them from whitelist before blacklisting.')]
          });
        }

        // Check if already blacklisted
        db.get(
          `SELECT * FROM blacklist_users WHERE owner_id = ? AND blacklisted_id = ? AND guild_id = ?`,
          [ownerId, blacklistedId, guildId],
          (err2, blacklistRow) => {
            if (err2) {
              console.error('Database error:', err2);
              return message.reply({
                embeds: [new EmbedBuilder().setColor('000000')
                  .setDescription('   Database error occurred.')]
              });
            }

            if (blacklistRow) {
              return message.reply({
                embeds: [new EmbedBuilder().setColor('000000')
                  .setDescription('   This user is already blacklisted by you.')]
              });
            }

            // Insert into blacklist
            db.run(
              `INSERT INTO blacklist_users (owner_id, blacklisted_id, guild_id) VALUES (?, ?, ?)`,
              [ownerId, blacklistedId, guildId],
              (err3) => {
                if (err3) {
                  console.error('Database error:', err3);
                  return message.reply({
                    embeds: [new EmbedBuilder().setColor('000000')
                      .setDescription('   Database error occurred while adding to blacklist.')]
                  });
                }

                message.reply({
                  embeds: [new EmbedBuilder().setColor('000000')
                    .setDescription(`<:arcadiatruee:1401752463144517652>  Successfully blacklisted ${userToAdd.tag}.`)]
                });
              }
            );
          }
        );
      }
    );
  }
};
