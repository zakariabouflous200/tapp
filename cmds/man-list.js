const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'man-list',
  async execute(message, args, client, db) {
    // Ensure the table exists (optional but safe)
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
          embeds: [new EmbedBuilder().setDescription('  Database error occurred.')]
        });
      }

      // Query all managers for this user
      db.all(`SELECT manager_id FROM user_managers WHERE owner_id = ?`, [message.author.id], async (err, rows) => {
        if (err) {
          console.error(err);
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('  Failed to fetch your manager list from the database.')]
          });
        }

        if (!rows.length) {
          return message.channel.send({
            embeds: [new EmbedBuilder().setDescription('ℹ️ You have no managers set yet.')]
          });
        }

        // Format list of managers
        const managers = rows.map(r => {
          const user = message.guild.members.cache.get(r.manager_id);
          return user ? `${user.user.tag} (<@${r.manager_id}>)` : `Unknown User (<@${r.manager_id}>)`;
        });

        const description = `🛡️ **Your managers:**\n${managers.join('\n')}`;

        message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setDescription(description)
          ]
        });
      });
    });
  }
};
