const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'help',
  description: 'Show bot help with category select menu',
  async execute(message, client) {
    if (!message.content.toLowerCase().startsWith('.v help')) return;

    // Accurate line count config
    const targetDirs = ['.', './cmds', './events'];
    const allowedExtensions = ['.js'];
    const excludedDirs = ['node_modules', '.git', 'sqlite', 'database', 'data'];

    let totalLines = 0;

    function countLinesInFile(filePath) {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.split('\n').length;
    }

    function scanDirectory(dirPath) {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          if (!excludedDirs.includes(entry)) {
            scanDirectory(fullPath);
          }
        } else if (allowedExtensions.includes(path.extname(entry))) {
          const lineCount = countLinesInFile(fullPath);
          totalLines += lineCount;
        }
      }
    }

    for (const dir of targetDirs) {
      scanDirectory(path.resolve(dir));
    }

    // Help categories
    const helpData = {
      voice: `**📡 Voice Commands:**
\`.v lock\` - Close it for everyone  
\`.v unlock\` - Open room for everyone  
\`.v permit\` - Give permission to someone to join you  
\`.v deny\` - Reject someone from your voice  
\`.v kick\` - Disconnect someone from your voice  
\`.v limit\` - Set VC limit  
\`.v name\` - Change voice channel name  
\`.v claim\` - Be owner of a voice channel  
\`.v transfer\` - Transfer voice ownership  
\`.v owner\` - See current owner  
\`.v status\` - Set voice status`,
      setup: `**🛠️ Setup Commands:**  
\`.v setup-room\` - Set up temp channel category  
\`.v set-event-manager\` - Set the event manager role  
\`.v set-event-category\` - Set the category for events  
\`.v set-event-logs\` - Set the logs channel for events`,
      manager: `**🧩 Managers:**  
\`.v man-add\` - Add a manager  
\`.v man-remove\` - Remove a manager  
\`.v man-clear\` - Clear all managers`,
      whitelist: `**🖊️ Whitelist:**  
\`.v wl-add\` - Add a user to whitelist  
\`.v wl-remove\` - Remove a user from whitelist  
\`.v wl-list\` - List whitelisted users`,
      blacklist: `**🏷️ Blacklist:**  
\`.v bl-add\` - Add a user to blacklist  
\`.v bl-remove\` - Remove a user from blacklist  
\`.v bl-list\` - List blacklisted users`,
    };

    // Embed
    const mainEmbed = new EmbedBuilder()
      .setTitle('⚙️  Switzerland  TAP ⚡Help ')
      .setDescription(`**⚡ Crafted By:** Zaw  <@1202396567093387327> & <@1033812944879898736>
**🖥️ Codebase Size:** \`${totalLines.toLocaleString()} lines\`

Please choose a category from the menu below to explore available commands.
Your journey with Switzerland Tap  starts here — control, manage, and enjoy.`)
      .setColor('#000000')
      .setFooter({ text: '  Switzerland TAP ⚡ — Your control center awaits! Select a category to proceed.' });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help-category-select')
      .setPlaceholder('⚙️ Choose a help category')
      .addOptions([
        {
          label: 'Voice Commands',
          description: 'Commands for voice channel management',
          value: 'voice',
        },
        {
          label: 'Setup Commands',
          description: 'Setup commands for temp channels',
          value: 'setup',
        },
        {
          label: 'Managers',
          description: 'Manage managers in the bot',
          value: 'manager',
        },
        {
          label: 'Whitelist',
          description: 'Whitelist command management',
          value: 'whitelist',
        },
        {
          label: 'Blacklist',
          description: 'Blacklist command management',
          value: 'blacklist',
        },
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const sentMessage = await message.channel.send({
      embeds: [mainEmbed],
      components: [row],
    });

    const collector = sentMessage.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
      filter: i => i.user.id === message.author.id,
    });

    collector.on('collect', async interaction => {
      const selected = interaction.values[0];
      const categoryEmbed = new EmbedBuilder()
        .setTitle(`${selected.charAt(0).toUpperCase() + selected.slice(1)} Commands`)
        .setDescription(helpData[selected])
        .setColor('#000000')
        .setFooter({ text: ' Switzerland TAP ⚡ • Use the menu to switch categories.' });

      await interaction.update({ embeds: [categoryEmbed], components: [row] });
    });

    collector.on('end', async () => {
      try {
        await sentMessage.edit({ components: [] });
      } catch {
        // message deleted or permissions issue
      }
    });
  },
};
