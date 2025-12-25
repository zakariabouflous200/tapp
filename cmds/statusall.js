const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

const DEV_IDS = (process.env.DEV_IDS || '')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

function isAuthorized(message) {
  const isOwner = message.guild?.ownerId === message.author.id;
  const isDev = DEV_IDS.includes(message.author.id);
  return isOwner || isDev;
}

// --- tiny sqlite promisified helpers ---
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}
function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function ensureTable(db) {
  await dbRun(db, `
    CREATE TABLE IF NOT EXISTS voice_status_settings (
      guild_id TEXT PRIMARY KEY,
      status   TEXT
    )
  `);
}

async function upsertStatus(db, guildId, text) {
  // try UPSERT
  try {
    await dbRun(db, `
      INSERT INTO voice_status_settings (guild_id, status)
      VALUES (?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET status=excluded.status
    `, [guildId, text]);
    return;
  } catch (e) {
    // fallback for old SQLite (no UPSERT)
    const row = await dbGet(db, `SELECT status FROM voice_status_settings WHERE guild_id = ?`, [guildId]).catch(() => null);
    if (row) {
      await dbRun(db, `UPDATE voice_status_settings SET status = ? WHERE guild_id = ?`, [text, guildId]);
    } else {
      await dbRun(db, `INSERT INTO voice_status_settings (guild_id, status) VALUES (?, ?)`, [guildId, text]);
    }
  }
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

module.exports = {
  name: 'statusall',
  description: 'Set/show/clear/apply a per-server voice status for all temp voice channels.',
  usage: '.v statusall set <text>\n.v statusall show\n.v statusall clear\n.v statusall applynow',
  async execute(message, args, client, db) {
    if (!isAuthorized(message)) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000')
          .setDescription('   Only the **server owner** or configured **devs** can use this command.')]
      });
    }

    const sub = (args[0] || '').toLowerCase();
    const guildId = message.guild.id;

    try {
      await ensureTable(db);

      if (sub === 'set') {
        const text = args.slice(1).join(' ').trim();
        if (!text) {
          return message.reply({ embeds: [new EmbedBuilder().setColor('000000').setDescription('Usage: `.v statusall set <text>`')] });
        }
        if (text.length > 128) {
          return message.reply({ embeds: [new EmbedBuilder().setColor('000000').setDescription('Status too long (max 128 chars).')] });
        }

        await upsertStatus(db, guildId, text);
        return message.reply({ embeds: [new EmbedBuilder().setColor('#2b2d31')
          .setDescription(`✅ Voice status set for this server:\n> ${text}`)] });
      }

      if (sub === 'show') {
        const row = await dbGet(db, `SELECT status FROM voice_status_settings WHERE guild_id = ?`, [guildId]);
        if (!row || !row.status) {
          return message.reply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription('No voice status is set for this server.')] });
        }
        return message.reply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription(`Current voice status:\n> ${row.status}`)] });
      }

      if (sub === 'clear') {
        await dbRun(db, `DELETE FROM voice_status_settings WHERE guild_id = ?`, [guildId]);
        return message.reply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription('⭕ Voice status cleared for this server.')] });
      }

      if (sub === 'applynow') {
        const row = await dbGet(db, `SELECT status FROM voice_status_settings WHERE guild_id = ?`, [guildId]);
        const statusText = row?.status;
        if (!statusText) {
          return message.reply({ embeds: [new EmbedBuilder().setColor('000000').setDescription('No status set. Use `.v statusall set <text>` first.')] });
        }

        const tempRows = await dbAll(db, `SELECT channel_id FROM temp_channels WHERE guild_id = ?`, [guildId]);
        if (!tempRows || tempRows.length === 0) {
          return message.reply({ embeds: [new EmbedBuilder().setColor('#2b2d31').setDescription('No temp voice channels to apply to.')] });
        }

        let ok = 0, fail = 0;
        for (const r of tempRows) {
          const ch = message.guild.channels.cache.get(r.channel_id);
          if (!ch) { fail++; continue; }
          try {
            await axios.put(`https://discord.com/api/v10/channels/${ch.id}/voice-status`, { status: statusText }, {
              headers: { Authorization: `Bot ${client.token}`, 'Content-Type': 'application/json' }
            });
            ok++;
            await sleep(250);
          } catch {
            fail++;
          }
        }

        return message.reply({ embeds: [new EmbedBuilder().setColor('#2b2d31')
          .setDescription(`Applied to temp VCs: **${ok}** success, **${fail}** failed.`)] });
      }

      // default usage
      return message.reply({
        embeds: [new EmbedBuilder().setColor('000000').setDescription(
          'Usage:\n' +
          '• `.v statusall set <text>`\n' +
          '• `.v statusall show`\n' +
          '• `.v statusall clear`\n' +
          '• `.v statusall applynow`'
        )]
      });
    } catch (err) {
      console.error('statusall error:', err);
      return message.reply({ embeds: [new EmbedBuilder().setColor('000000').setDescription('Database error.')] });
    }
  }
};
