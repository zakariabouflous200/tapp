require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// ----------------------- Safety: Token check -----------------------
if (!process.env.TOKEN) {
  console.error('  No token found in .env file!');
  process.exit(1);
}

// ----------------------- Discord Client ---------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Make commands collection
client.commands = new Collection();

// ----------------------- SQLite Helpers ---------------------------
function openDatabase(dbFile, label) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFile, (err) => {
      if (err) {
        console.error(`❌ Failed to open ${label}:`, err.message);
        return reject(err);
      }
      console.log(`📊 Connected to ${dbFile}`);
      resolve(db);
    });
  });
}

let configDB;
let taskDB;

// ----------------------- Bootstrap DBs -----------------------------
(async () => {
  try {
    configDB = await openDatabase('./config.db', 'config.db');
    taskDB   = await openDatabase('./task.db',   'task.db');

    // Create / migrate tables
    configDB.serialize(() => {
      // Per-guild config (room + prefix)
      configDB.run(`
        CREATE TABLE IF NOT EXISTS guild_config (
          guild_id TEXT PRIMARY KEY,
          room_id  TEXT,
          prefix   TEXT DEFAULT '.v'
        )
      `);

      // Temp VC ownership
      configDB.run(`
        CREATE TABLE IF NOT EXISTS temp_channels (
          channel_id TEXT PRIMARY KEY,
          owner_id   TEXT,
          guild_id   TEXT
        )
      `);

      // VC managers (owner -> manager)
      configDB.run(`
        CREATE TABLE IF NOT EXISTS user_managers (
          owner_id   TEXT,
          manager_id TEXT,
          PRIMARY KEY (owner_id, manager_id)
        )
      `);

      // Whitelist per owner / guild
      configDB.run(`
        CREATE TABLE IF NOT EXISTS whitelist_users (
          owner_id       TEXT,
          whitelisted_id TEXT,
          guild_id       TEXT,
          PRIMARY KEY (owner_id, whitelisted_id, guild_id)
        )
      `);

      // Blacklist per owner / guild
      configDB.run(`
        CREATE TABLE IF NOT EXISTS blacklist_users (
          owner_id       TEXT,
          blacklisted_id TEXT,
          guild_id       TEXT,
          PRIMARY KEY (owner_id, blacklisted_id, guild_id)
        )
      `);

      // Channels locked by command (fallback flag)
      configDB.run(`
        CREATE TABLE IF NOT EXISTS locked_channels (
          channel_id TEXT,
          guild_id   TEXT,
          PRIMARY KEY (channel_id, guild_id)
        )
      `);

      // Event/task misc tables if your project uses them
      configDB.run(`
        CREATE TABLE IF NOT EXISTS event_manager (
          server_id TEXT,
          tasker_id TEXT,
          PRIMARY KEY (server_id, tasker_id)
        )
      `);

      configDB.run(`
        CREATE TABLE IF NOT EXISTS task_settings (
          server_id TEXT PRIMARY KEY,
          logs_id   TEXT
        )
      `);

      // NEW: Anti-Admin (per guild)
      configDB.run(`
        CREATE TABLE IF NOT EXISTS antiadmin_settings (
          guild_id TEXT PRIMARY KEY,
          enabled  INTEGER DEFAULT 0
        )
      `);

      // NEW: Limit-Guard (per guild)
      configDB.run(`
        CREATE TABLE IF NOT EXISTS limitguard_settings (
          guild_id TEXT PRIMARY KEY,
          enabled  INTEGER DEFAULT 0
        )
      `);
    });

    // -------------------- Load Commands --------------------
    console.log('📁 Loading commands...');
    const cmdsPath = path.join(__dirname, 'cmds');
    if (fs.existsSync(cmdsPath)) {
      const files = fs.readdirSync(cmdsPath).filter(f => f.endsWith('.js'));
      for (const file of files) {
        const full = path.join(cmdsPath, file);
        try {
          const command = require(full);
          if (!command?.name || typeof command.execute !== 'function') {
            console.warn(`⚠️ Skipping invalid command file: ${file}`);
            continue;
          }
          client.commands.set(command.name, command);
          console.log(`✅ Loaded command: ${command.name}`);
        } catch (err) {
          console.error(` Error loading command ${file}: ${err.stack || err.message}`);
        }
      }
    } else {
      console.warn('⚠️ cmds/ folder not found.');
    }

    // -------------------- Load Events ----------------------
    console.log('📁 Loading events...');
    const eventsPath = path.join(__dirname, 'events');
    if (fs.existsSync(eventsPath)) {
      const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

      for (const file of files) {
        // We’ll register button.js separately below to pass taskDB too.
        if (file === 'button.js') continue;

        try {
          const event = require(path.join(eventsPath, file));
          if (!event?.name || typeof event.execute !== 'function') {
            console.warn(`⚠️ Skipping invalid event file: ${file}`);
            continue;
          }

          if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client, configDB));
          } else {
            client.on(event.name,  (...args) => event.execute(...args, client, configDB));
          }
          console.log(`✅ Loaded event: ${event.name}`);
        } catch (err) {
          console.error(`  Error loading event ${file}: ${err.stack || err.message}`);
        }
      }
    } else {
      console.warn('⚠️ events/ folder not found.');
    }

    // -------------------- Message Command Router -----------
    // (If your project already has an events/messageCreate.js that routes commands,
    //  you can skip this block. Keeping it minimal here.)
    // Example of messageCreate is normally in events/messageCreate.js and will read prefix from DB.

    // -------------------- Login ----------------------------
    client.login(process.env.TOKEN);

    // -------------------- Special: button.js (needs taskDB) ----
    try {
      const buttonEvent = require('./events/button.js');
      if (buttonEvent?.name && typeof buttonEvent.execute === 'function') {
        client.on(buttonEvent.name, (...args) => {
          // args[0] is the Interaction
          buttonEvent.execute(...args, client, configDB, taskDB);
        });
        // Not printing twice in logs, but you can:
        // console.log(`✅ Loaded event: ${buttonEvent.name} (with taskDB)`);
      }
    } catch (err) {
      // Optional: button.js might not exist
    }

    // Export for other modules if they import index.js
    module.exports = { client, configDB, taskDB };

  } catch (err) {
    console.error('  Fatal bootstrap error:', err);
    process.exit(1);
  }
})();
