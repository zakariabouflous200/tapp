const { EmbedBuilder, Events, PermissionsBitField } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client, db) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'features_menu') return;
    if (!interaction.guild || !interaction.channel) return;

    const member = interaction.member;
    const channel = interaction.channel;
    const selected = interaction.values[0];

    // Embed builder helper
    const createEmbed = (desc, color = 0x0099ff) =>
      new EmbedBuilder().setDescription(desc).setColor(color);

    // DB utilities
    async function isManagerOf(ownerId, managerId) {
      return new Promise((resolve) => {
        db.get(
          `SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?`,
          [ownerId, managerId],
          (err, row) => {
            if (err) {
              console.error('DB Error (user_managers):', err);
              return resolve(false);
            }
            resolve(!!row);
          }
        );
      });
    }

    async function getOwnerId(channelId) {
      return new Promise((resolve) => {
        db.get(
          `SELECT owner_id FROM temp_channels WHERE channel_id = ?`,
          [channelId],
          (err, row) => {
            if (err) {
              console.error('DB Error (temp_channels):', err);
              return resolve(null);
            }
            resolve(row ? row.owner_id : null);
          }
        );
      });
    }

    async function isAuthorized(channelId, memberId) {
      const ownerId = await getOwnerId(channelId);
      if (!ownerId) return { authorized: false, ownerId: null };
      const isOwner = ownerId === memberId;
      const isManager = await isManagerOf(ownerId, memberId);
      return { authorized: isOwner || isManager, ownerId, isOwner };
    }

    // Permission check
    const auth = await isAuthorized(channel.id, member.id);
    if (!auth.authorized) {
      return interaction.reply({
        ephemeral: true,
        embeds: [createEmbed('    Only the voice channel owner or their managers can use this menu.')],
      });
    }

    try {
      let response;

      switch (selected) {
        case 'soundboard_on':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.UseSoundboard]: true,
          });
          response = '<:arcadiasbon:1401751447204266076> Soundboard enabled in this channel.';
          break;

        case 'soundboard_off':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.UseSoundboard]: false,
          });
          response = '<:arcadiasboff:1401751570508419223>  Soundboard disabled in this channel.';
          break;

        case 'camera_on':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.Stream]: true,
          });
          response = '<:arcadiacamon:1401751735508144250> Camera (stream) enabled in this channel.';
          break;

        case 'camera_off':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.Stream]: false,
          });
          response = '<:arcadiacamoff:1401751870430515211>  Camera (stream) disabled in this channel.';
          break;

        case 'activities_on':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.UseExternalApps]: true,
          });
          response = '<:acradiaacton:1401752018158096566>  Activities enabled in this channel.';
          break;

        case 'activities_off':
          await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            [PermissionsBitField.Flags.UseExternalApps]: false,
          });
          response = '<:arcadiaactoff:1401752186009948163>  Activities disabled in this channel.';
          break;

        default:
          response = '    Unknown selection.';
      }

      await interaction.reply({
        ephemeral: true,
        embeds: [createEmbed(response)],
      });

    } catch (err) {
      console.error('    Feature menu error:', err);
      await interaction.reply({
        ephemeral: true,
        embeds: [createEmbed('    Something went wrong while applying the feature.', 0xff0000)],
      });
    }
  }
};
