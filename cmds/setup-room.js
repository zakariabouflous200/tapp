const { EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  name: 'setup-room',
  async execute(message, args, client, db) {
    if (!message.member.permissions.has('Administrator')) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription("🚫 You need **Administrator** permission to use this command.")
        ]
      });
    }

    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);

    if (!channel) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription("   Please specify a valid voice channel.\n\n**Usage:** `.v setup-room <channel>`")
        ]
      });
    }

    if (channel.type !== ChannelType.GuildVoice) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder().setDescription("⚠️ The specified channel must be a **voice channel**.")
        ]
      });
    }

    // Check if config already exists
    db.get(`SELECT * FROM guild_config WHERE guild_id = ?`, [message.guild.id], (err, row) => {
      if (err) {
        console.error(err);
        return message.channel.send({
          embeds: [
            new EmbedBuilder().setDescription("   Failed to access configuration.")
          ]
        });
      }

      const isUpdate = !!row;

      const query = isUpdate
        ? `UPDATE guild_config SET room_id = ? WHERE guild_id = ?`
        : `INSERT INTO guild_config (room_id, guild_id) VALUES (?, ?)`;

      db.run(query, [channel.id, message.guild.id], (err) => {
        if (err) {
          console.error(err);
          return message.channel.send({
            embeds: [
              new EmbedBuilder().setDescription("   Failed to save configuration.")
            ]
          });
        }

        message.channel.send({
          embeds: [
            new EmbedBuilder().setDescription(`${isUpdate ? '🔁' : '<:arcadiatruee:1401752463144517652> '} ${isUpdate ? 'Updated' : 'Setup complete'}.\n\nUsers who join ${channel} will now trigger temp room creation.`)
          ]
        });
      });
    });
  }
};
