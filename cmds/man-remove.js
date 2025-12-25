const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'man-remove',
  description: 'Remove a manager from your manager list.',
  usage: '.v man-remove @user or .v man-remove userID',
  async execute(message, args, client, db) {
    if (!args[0]) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setColor('000000')
          .setDescription('   Please provide a user mention or ID to remove as manager.\nUsage: `.v man-remove @user` or `.v man-remove userID`')]
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

    const managerId = extractId(args[0]);
    if (!managerId) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setColor('000000')
          .setDescription('   Please provide a valid user mention or ID.')]
      });
    }

    const ownerId = message.author.id;

    // Ensure the table exists (optional safety)
    db.run(`
      CREATE TABLE IF NOT EXISTS user_managers (
        owner_id TEXT,
        manager_id TEXT,
        PRIMARY KEY (owner_id, manager_id)
      )
    `, (err) => {
      if (err) {
        console.error(err);
        return message.channel.send({
          embeds: [new EmbedBuilder().setColor('000000')
            .setDescription('   Database error occurred while ensuring table exists.')]
        });
      }

      // Check if this manager exists for the owner
      db.get(`SELECT * FROM user_managers WHERE owner_id = ? AND manager_id = ?`, [ownerId, managerId], (err2, row) => {
        if (err2) {
          console.error(err2);
          return message.channel.send({
            embeds: [new EmbedBuilder().setColor('000000')
              .setDescription('   Database query error occurred.')]
          });
        }

        if (!row) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setColor('000000')
              .setDescription('   This user is not your manager.')]
          });
        }

        // Delete the manager
        db.run(`DELETE FROM user_managers WHERE owner_id = ? AND manager_id = ?`, [ownerId, managerId], (err3) => {
          if (err3) {
            console.error(err3);
            return message.channel.send({
              embeds: [new EmbedBuilder().setColor('000000')
                .setDescription('   Failed to remove manager due to database error.')]
            });
          }

          message.channel.send({
            embeds: [new EmbedBuilder().setColor('000000')
              .setDescription(`<:arcadiatruee:1401752463144517652>  Successfully removed <@${managerId}> from your managers.`)]
          });
        });
      });
    });
  }
};
