const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'wl-add',
  description: 'Add a user to your whitelist (max 5)',
  usage: '.wl-add @user / ID',
  async execute(message, args, client, db) {
    if (!args[0]) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000')
          .setDescription('   Please mention a user or provide their ID to whitelist.')]
      });
    }

    // helper: mention or ID
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
          .setDescription('   You cannot whitelist yourself.')]
      });
    }

    const ownerId = message.author.id;
    const guildId = message.guild.id;
    const whitelistedId = userToAdd.id;

    // Check if user is blacklisted first
    db.get(
      `SELECT * FROM blacklist_users WHERE owner_id = ? AND blacklisted_id = ? AND guild_id = ?`,
      [ownerId, whitelistedId, guildId],
      (err, blacklistRow) => {
        if (err) {
          console.error('Database error:', err);
          return message.reply({
            embeds: [new EmbedBuilder().setColor('000000')
              .setDescription('   Database error occurred.')]
          });
        }

        if (blacklistRow) {
          return message.reply({
            embeds: [new EmbedBuilder().setColor('000000')
              .setDescription('   This user is blacklisted. Remove them from blacklist before whitelisting.')]
          });
        }

        // Count how many are whitelisted
        db.get(
          `SELECT COUNT(*) AS count FROM whitelist_users WHERE owner_id = ? AND guild_id = ?`,
          [ownerId, guildId],
          (err2, row) => {
            if (err2) {
              console.error('Database error:', err2);
              return message.reply({
                embeds: [new EmbedBuilder().setColor('000000')
                  .setDescription('   Database error occurred.')]
              });
            }

            if (row.count >= 5) {
              return message.reply({
                embeds: [new EmbedBuilder().setColor('000000')
                  .setDescription('   You have already whitelisted 5 users. Remove some before adding more.')]
              });
            }

            // Check if already whitelisted
            db.get(
              `SELECT * FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?`,
              [ownerId, whitelistedId, guildId],
              (err3, exists) => {
                if (err3) {
                  console.error('Database error:', err3);
                  return message.reply({
                    embeds: [new EmbedBuilder().setColor('000000')
                      .setDescription('   Database error occurred.')]
                  });
                }

                if (exists) {
                  return message.reply({
                    embeds: [new EmbedBuilder().setColor('000000')
                      .setDescription('   This user is already whitelisted by you.')]
                  });
                }

                // Insert whitelist
                db.run(
                  `INSERT INTO whitelist_users (owner_id, whitelisted_id, guild_id) VALUES (?, ?, ?)`,
                  [ownerId, whitelistedId, guildId],
                  (err4) => {
                    if (err4) {
                      console.error('Database error:', err4);
                      return message.reply({
                        embeds: [new EmbedBuilder().setColor('000000')
                          .setDescription('   Database error occurred while adding whitelist.')]
                      });
                    }

                    message.reply({
                      embeds: [new EmbedBuilder().setColor('000000')
                        .setDescription(`<:arcadiatruee:1401752463144517652>  Successfully whitelisted ${userToAdd.tag}.`)]
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  }
};
