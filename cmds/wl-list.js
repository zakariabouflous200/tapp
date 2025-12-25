module.exports = {
    name: 'wl-list',
    description: 'List your whitelisted users',
    usage: '.wl-list',
    async execute(message, args, client, db) {
      const ownerId = message.author.id;
      const guildId = message.guild.id;
  
      db.all(
        `SELECT whitelisted_id FROM whitelist_users WHERE owner_id = ? AND guild_id = ?`,
        [ownerId, guildId],
        async (err, rows) => {
          if (err) return message.reply('   Database error.');
  
          if (!rows.length) {
            return message.reply('ℹ️ You have not whitelisted any users yet.');
          }
  
          // Fetch user objects for nicer display
          const userList = rows.map(r => `<@${r.whitelisted_id}>`).join('\n');
  
          message.reply(`📋 Your whitelisted users:\n${userList}`);
        }
      );
    }
  };
  