const { EmbedBuilder } = require('discord.js');

const DEV_IDS = (process.env.DEV_IDS || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

function isAuthorized(message, ownerId) {
  // server owner or devs can see any list; room owner can see their own
  const isGuildOwner = message.guild?.ownerId === message.author.id;
  const isDev = DEV_IDS.includes(message.author.id);
  const isRoomOwner = ownerId === message.author.id;
  return isGuildOwner || isDev || isRoomOwner;
}

module.exports = {
  name: 'wllist',
  description: 'Show the whitelist for the current temporary voice channel.',
  usage: '.v wllist',
  async execute(message, args, client, db) {
    const guild = message.guild;
    const guildId = guild.id;
    const voice = message.member?.voice?.channel;

    if (!voice) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000').setDescription('You must be in a temporary voice channel.')]
      });
    }

    // Find the owner of this temp channel
    const row = await new Promise(res => {
      db.get(
        `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
        [voice.id, guildId],
        (e, r) => res(r)
      );
    });

    if (!row) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000').setDescription('This voice channel is not registered as a temporary channel.')]
      });
    }

    const ownerId = row.owner_id;
    if (!isAuthorized(message, ownerId)) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000').setDescription('   Only the voice owner, server owner, or configured devs can use this command.')]
      });
    }

    // Fetch whitelist rows
    const list = await new Promise(res => {
      db.all(
        `SELECT whitelisted_id FROM whitelist_users WHERE owner_id = ? AND guild_id = ?`,
        [ownerId, guildId],
        (e, rows) => res(rows || [])
      );
    });

    if (!list.length) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000').setDescription('Whitelist is empty for this voice.')]
      });
    }

    // Format: mentions
    const mentions = [];
    for (const r of list) {
      const id = r.whitelisted_id;
      mentions.push(`<@${id}>`);
    }

    // Split if too long
    const chunks = [];
    let buf = '';
    for (const m of mentions) {
      if ((buf + m + '\n').length > 3800) {
        chunks.push(buf);
        buf = '';
      }
      buf += m + '\n';
    }
    if (buf) chunks.push(buf);

    for (let i = 0; i < chunks.length; i++) {
      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle(`Whitelist (${list.length}) — Owner: <@${ownerId}>`)
        .setDescription(chunks[i]);
      await message.channel.send({ embeds: [embed] });
    }
  }
};
