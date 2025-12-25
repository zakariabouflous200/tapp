const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const voiceDbPath = path.resolve(__dirname, './voice_time.db'); // adjust the path to your DB file
const voiceDb = new sqlite3.Database(voiceDbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open voice_time.db:', err);
    return;
  }
  console.log('Opened voice_time.db successfully');
});

voiceDb.all(`SELECT * FROM voice_sessions`, (err, rows) => {
  if (err) {
    console.error('Error querying voice_sessions:', err);
    return;
  }

  if (rows.length === 0) {
    console.log('No active voice sessions found.');
  } else {
    rows.forEach(row => {
      console.log(`User ID: ${row.user_id}, Guild ID: ${row.guild_id}, Channel ID: ${row.channel_id}, Joined at: ${new Date(row.join_timestamp).toLocaleString()}`);
    });
  }
  
  voiceDb.close();
});
