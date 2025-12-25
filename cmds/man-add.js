const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'man-add',
  async execute(message, args, client, db) {
    if (!args[0]) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setColor('000000')
          .setDescription('   Please provide a user mention or ID to add as manager.\nUsage: `.v man-add @user` or `.v man-add userID`')]
      });
    }

    // Helper: extract ID from mention or raw number
    const extractId = (arg) => {
      if (!arg) return null;
      const mentionMatch = arg.match(/^<@!?(\d{17,20})>$/);
      if (mentionMatch) return mentionMatch[1];
      if (/^\d{17,20}$/.test(arg)) return arg;
      return null;
    };

    const userId = extractId(args[0]);
    if (!userId) {
      return message.channel.send({
        embeds: [new EmbedBuilder().setColor('000000')
          .setDescription('   Please provide a valid user mention or ID.')]
      });
    }

    db.all(`SELECT * FROM user_managers WHERE owner_id = ?`, [message.author.id], (err, rows) => {
      if (err) {
        console.error(err);
        return message.channel.send({
          embeds: [new EmbedBuilder().setColor('000000')
            .setDescription('   Database query error occurred.')]
        });
      }

      if (rows.length >= 6) {
        return message.channel.send({
          embeds: [new EmbedBuilder().setColor('000000')
            .setDescription('   Maximum number of managers (6) reached for you.')]
        });
      }

      db.get(`SELECT * FROM user_managers WHERE owner_id = ? AND manager_id = ?`, [message.author.id, userId], (err2, row) => {
        if (err2) {
          console.error(err2);
          return message.channel.send({
            embeds: [new EmbedBuilder().setColor('000000')
              .setDescription('   Database query error occurred.')]
          });
        }

        if (row) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setColor('000000')
              .setDescription('   This user is already your manager.')]
          });
        }

        db.run(`INSERT INTO user_managers (owner_id, manager_id) VALUES (?, ?)`, [message.author.id, userId], (err3) => {
          if (err3) {
            console.error(err3);
            return message.channel.send({
              embeds: [new EmbedBuilder().setColor('000000')
                .setDescription('   Failed to add manager due to database error.')]
            });
          }

          message.channel.send({
            embeds: [new EmbedBuilder().setColor('000000')
              .setDescription(`<:arcadiatruee:1401752463144517652>  Successfully added <@${userId}> as your manager.`)]
          });
        });
      });
    });
  }
};
