const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const voiceDbPath = path.resolve(__dirname, '../voice_time.db');
const voiceDb = new sqlite3.Database(voiceDbPath, (err) => {
  if (err) {
    console.error('❌ Failed to open DB:', err.message);
  } else {
    console.log('✅ Connected to voice_time.db');
  }
});

module.exports = voiceDb;
