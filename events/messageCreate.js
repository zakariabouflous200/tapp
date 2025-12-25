module.exports = {
    name: 'messageCreate',
    async execute(message, client, db) {
      if (message.author.bot || !message.guild) return;
  
      db.get(
        `SELECT prefix FROM guild_config WHERE guild_id = ?`,
        [message.guild.id],
        (err, row) => {
          const prefix = row?.prefix || '.v';
          if (!message.content.startsWith(prefix)) return;
  
          const args = message.content.slice(prefix.length).trim().split(/\s+/);
          const cmdName = args.shift().toLowerCase();
  
          // Try get command by name
          let command = client.commands.get(cmdName);
  
          // If not found, try to find command by alias
          if (!command) {
            command = client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(cmdName));
          }
  
          if (command) {
            try {
              command.execute(message, args, client, db);
            } catch (err) {
              console.error(err);
              message.channel.send({
                embeds: [
                  new require('discord.js').EmbedBuilder().setDescription("    Error executing command.")
                ]
              });
            }
          }
        }
      );
    }
  };
  