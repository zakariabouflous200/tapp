const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits
} = require('discord.js');

module.exports = {
  name: 'panel',
  description: 'Send the voice room control panel.',
  async execute(message, args, client) {
    const bannerURL = 'https://media.discordapp.net/attachments/1299884084356579439/1401797449919762482/altf4.gif?ex=6891951c&is=6890439c&hm=fb5ee77ed84feb3a5503be1e78243f282fe314f0fc98a2865ce6c8432996cd31&=&width=2249&height=1265';

    const embed = new EmbedBuilder()
      .setTitle(`Welcome !!`)
      .setDescription(
        `<a:uwutantrum:1386470881114722356>  Your private voice control Hub — designed for effortless management, smooth control, and a premium experience.
Welcome to **__Switzerland__** — where your voice space is truly yours. <a:aedgy_twinkle:1383782281532932287> \n\n` +
        `> bla **Lock**\n` +
        `> c **Unlock your voice room**\n` +
        `> cro **Show Owner Of VC**\n` +
        `> e1790a519413e9689d274a84e **Set user limit**\n` +
        `>  **Rename**\n` +
        `>  **Delete All Msgs In VC**\n` +
        `> **Permit**\n` +
        `>  **Deny members**`
      )
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 128 }))
      .setImage(bannerURL)
      .setColor('#2b2d31');


    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lock').setLabel('Lock').setEmoji('<:black_lock:1391080843577131221>').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('unlock').setLabel('Unlock').setEmoji('<:closed76:1391080892604350625>').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('claim').setLabel('Owner').setEmoji('<:crown_drax:1391070112756531320>').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('setVoiceLimit').setLabel('Limit').setEmoji('<:e1790a519413e9689d274a84e3671ac6:1396276479347789936>').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('permit').setLabel('Permit').setEmoji('<:true:1391089517783678986>').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('deny').setLabel('Deny').setEmoji('<:false:1391089516432850984>').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('name').setLabel('Rename').setEmoji('<:icons8edit64:1396276486679298210>').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('trash').setLabel('Clear Msgs').setEmoji('<:trash:1391088366602162250>').setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('features_menu')
        .setPlaceholder('🔥 Other Options')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('sb - ON').setValue('soundboard_on').setEmoji('<:arcadiasbon:1384183874405273681>'),
          new StringSelectMenuOptionBuilder().setLabel('sb - OFF').setValue('soundboard_off').setEmoji('<:arcadiasboff:1401751570508419223>'),
          new StringSelectMenuOptionBuilder().setLabel('Cam - ON').setValue('camera_on').setEmoji('<:arcadiacamon:1401751735508144250>'),
          new StringSelectMenuOptionBuilder().setLabel('Cam - OFF').setValue('camera_off').setEmoji('<:arcadiacamoff:1401751870430515211>'),
          new StringSelectMenuOptionBuilder().setLabel('Activities - ON').setValue('activities_on').setEmoji('<:acradiaacton:1401752018158096566>'),
          new StringSelectMenuOptionBuilder().setLabel('Activities - OFF').setValue('activities_off').setEmoji('<:arcadiaactoff:1401752186009948163>')
        )
    );

    await message.channel.send({
      embeds: [embed],
      components: [row1, row2, row3]
    });
  }
};
