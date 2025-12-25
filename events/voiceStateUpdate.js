const {
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  OverwriteType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');

const axios = require('axios'); // for voice status setting
const cooldown = new Set();

/* -------- Helpers: permissions / flags -------- */

// explicit member DENY on CONNECT/VIEW?
function isDeniedByOverwrite(memberId, channel) {
  const ow = channel.permissionOverwrites?.resolve(memberId);
  if (!ow) return false;
  const denyConnect = ow.deny?.has?.(PermissionFlagsBits.Connect);
  const denyView = ow.deny?.has?.(PermissionFlagsBits.ViewChannel);
  return Boolean(denyConnect || denyView);
}

// explicit member ALLOW on CONNECT? (permit)
function hasAllowConnect(memberId, channel) {
  const ow = channel.permissionOverwrites?.resolve(memberId);
  return Boolean(ow && ow.allow?.has?.(PermissionFlagsBits.Connect));
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client, db) {
    // === Anti-Admin / Limit-Guard enforcement (whitelist/owner/manager/permit are always allowed) ===
    try {
      const joinedNewChannel =
        newState.channelId &&
        newState.channel &&
        (!oldState.channelId || oldState.channelId !== newState.channelId);

      if (joinedNewChannel) {
        const guildId = newState.guild.id;
        const channelId = newState.channelId;

        // read toggles (per guild)
        const [antiOn, limitOn] = await Promise.all([
          new Promise((resolve) => {
            db.get(
              `SELECT enabled FROM antiadmin_settings WHERE guild_id = ?`,
              [guildId],
              (err, row) => resolve(row?.enabled === 1)
            );
          }),
          new Promise((resolve) => {
            db.get(
              `SELECT enabled FROM limitguard_settings WHERE guild_id = ?`,
              [guildId],
              (err, row) => resolve(row?.enabled === 1)
            );
          }),
        ]);

        const everyoneId = newState.guild.roles.everyone.id;
        const owEveryone = newState.channel.permissionOverwrites?.resolve(everyoneId);
        const denyEveryoneConnect = owEveryone ? owEveryone.deny.has(PermissionFlagsBits.Connect) : false;
        const nameLocked = newState.channel.name?.startsWith('🔒 ');
        const hasLimit = typeof newState.channel.userLimit === 'number' && newState.channel.userLimit > 0;

        // channel considered locked if @everyone has CONNECT denied, or name starts with lock,
        // or present in locked_channels table
        let baseLocked = denyEveryoneConnect || nameLocked;
        if (!baseLocked) {
          const isLockedTable = await new Promise((resolve) => {
            db.get(
              `SELECT 1 FROM locked_channels WHERE channel_id = ? AND guild_id = ?`,
              [channelId, guildId],
              (err, row) => resolve(!!row)
            );
          });
          if (!baseLocked) baseLocked = isLockedTable;
        }

        // limit logic: only enforce when actually exceeding the limit
        const overLimit = hasLimit && (newState.channel.members?.size > newState.channel.userLimit);

        const member = newState.member;
        if (!member) return;
        const memberId = member.id;

        // ---- Privilege checks: Owner / Whitelist / Manager / Permit (ALLOW CONNECT) ----
        let isPrivileged = false;

        // owner of this temp VC?
        const ownerId = await new Promise((resolve) => {
          db.get(
            `SELECT owner_id FROM temp_channels WHERE channel_id = ? AND guild_id = ?`,
            [channelId, guildId],
            (err, row) => resolve(row?.owner_id || null)
          );
        });

        if (ownerId) {
          // whitelist
          const isWl = await new Promise((resolve) => {
            db.get(
              `SELECT 1 FROM whitelist_users WHERE owner_id = ? AND whitelisted_id = ? AND guild_id = ?`,
              [ownerId, memberId, guildId],
              (err, row) => resolve(!!row)
            );
          });
          if (isWl) isPrivileged = true;

          // owner
          if (memberId === ownerId) isPrivileged = true;

          // manager
          if (!isPrivileged) {
            const isManager = await new Promise((resolve) => {
              db.get(
                `SELECT 1 FROM user_managers WHERE owner_id = ? AND manager_id = ?`,
                [ownerId, memberId],
                (err, row) => resolve(!!row)
              );
            });
            if (isManager) isPrivileged = true;
          }
        }

        // explicit ALLOW (permit)
        if (!isPrivileged && hasAllowConnect(memberId, newState.channel)) {
          isPrivileged = true;
        }

        // If privileged, NEVER disconnect. Also, if whitelisted but there is an explicit DENY, override to allow.
        if (isPrivileged) {
          const ow = newState.channel.permissionOverwrites?.resolve(memberId);
          const hasDeny = ow && (ow.deny?.has?.(PermissionFlagsBits.Connect) || ow.deny?.has?.(PermissionFlagsBits.ViewChannel));
          if (hasDeny && newState.channel.manageable) {
            await newState.channel.permissionOverwrites
              .edit(memberId, { Connect: true, ViewChannel: true })
              .catch(() => {});
          }
          return; // privileged users are always allowed
        }

        // ---- Non-privileged path ----
        const perms = newState.channel.permissionsFor?.(member);
        const hasConnect = perms?.has?.(PermissionFlagsBits.Connect);
        const memberHasExplicitDeny = isDeniedByOverwrite(memberId, newState.channel);

        // 0) Anti-Admin: if ON and member has explicit DENY on CONNECT/VIEW → disconnect ALWAYS (even without lock/limit)
        if (antiOn && memberHasExplicitDeny) {
          setTimeout(() => newState.disconnect().catch(() => {}), 250);
          return;
        }

        // 1) Limit-Guard: only when truly over the limit
        if (limitOn && overLimit) {
          setTimeout(() => newState.disconnect().catch(() => {}), 250);
          return;
        }

        // 2) Locked channel: require CONNECT
        if (baseLocked && !hasConnect) {
          setTimeout(() => newState.disconnect().catch(() => {}), 250);
          return;
        }
      }
    } catch (e) {
      console.error('AntiAdmin/LimitGuard enforcement error:', e);
    }
    // === end Anti-Admin / Limit-Guard enforcement ===

    if (!newState.guild) return;

    const guildId = newState.guild.id;
    const userId = newState.id;

    db.get(`SELECT room_id FROM guild_config WHERE guild_id = ?`, [guildId], async (err, row) => {
      if (err) return console.error(err);
      if (!row) return;

      const tempRoomId = row.room_id;

      // User joins temp room (trigger)
      if (
        (!oldState.channelId || oldState.channelId !== tempRoomId) &&
        newState.channelId === tempRoomId
      ) {
        // Cooldown
        if (cooldown.has(userId)) {
          try {
            const embed = new EmbedBuilder()
              .setTitle('😈 I Caught You Aw9!')
              .setDescription(
                `You tried to bug the system.\n\n> **Nice try daddy.**\n> Leave the trigger voice channel and wait **3 seconds** before trying again.`
              )
              .setColor('#ff69b4');
            await newState.member.send({ embeds: [embed] }).catch(() => {});
          } catch (e) {
            console.warn('Could not DM user:', e.message);
          }
          return;
        }

        cooldown.add(userId);
        setTimeout(() => cooldown.delete(userId), 3000); // 3s

        try {
          const parentCategory = newState.guild.channels.cache.get(tempRoomId)?.parent;
          const channelName = ` ${newState.member.displayName}`;

          const newVoiceChannel = await newState.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: parentCategory?.id || null,
            lockPermissions: true,
          });

          // inherit parent overwrites
          if (parentCategory) {
            const parentOverwrites = parentCategory.permissionOverwrites.cache.map((overwrite) => ({
              id: overwrite.id,
              allow: overwrite.allow,
              deny: overwrite.deny,
              type: overwrite.type,
            }));
            await newVoiceChannel.permissionOverwrites.set(parentOverwrites).catch(console.error);
          }

          // apply WL/BL overwrites for the owner on their new VC
          db.all(
            `SELECT whitelisted_id FROM whitelist_users WHERE owner_id = ? AND guild_id = ?`,
            [userId, guildId],
            async (err, whitelistRows) => {
              if (err) return console.error('DB whitelist fetch error:', err);

              db.all(
                `SELECT blacklisted_id FROM blacklist_users WHERE owner_id = ? AND guild_id = ?`,
                [userId, guildId],
                async (err2, blacklistRows) => {
                  if (err2) return console.error('DB blacklist fetch error:', err2);

                  const permissionOverwrites = [
                    ...newVoiceChannel.permissionOverwrites.cache.values(),
                  ].map((overwrite) => ({
                    id: overwrite.id,
                    allow: overwrite.allow,
                    deny: overwrite.deny,
                    type: overwrite.type,
                  }));

                  if (whitelistRows?.length) {
                    for (const wlUser of whitelistRows) {
                      try {
                        const member = await newState.guild.members
                          .fetch(wlUser.whitelisted_id)
                          .catch(() => null);
                        if (member) {
                          permissionOverwrites.push({
                            id: member.id,
                            allow: [PermissionFlagsBits.Connect],
                            type: OverwriteType.Member,
                          });
                        }
                      } catch {}
                    }
                  }

                  if (blacklistRows?.length) {
                    for (const blUser of blacklistRows) {
                      try {
                        const member = await newState.guild.members
                          .fetch(blUser.blacklisted_id)
                          .catch(() => null);
                        if (member) {
                          permissionOverwrites.push({
                            id: member.id,
                            deny: [PermissionFlagsBits.Connect],
                            type: OverwriteType.Member,
                          });
                        }
                      } catch {}
                    }
                  }

                  await newVoiceChannel.permissionOverwrites
                    .set(permissionOverwrites)
                    .catch(console.error);
                }
              );
            }
          );

          // move the user into their temp VC
          if (newState.channel) {
            try {
              await newState.setChannel(newVoiceChannel);

              // per-server voice status
              try {
                const rowStatus = await new Promise((res) => {
                  db.get(
                    `SELECT status FROM voice_status_settings WHERE guild_id = ?`,
                    [guildId],
                    (e, r) => res(r)
                  );
                });
                const statusText = rowStatus?.status;
                if (statusText) {
                  await axios.put(
                    `https://discord.com/api/v10/channels/${newVoiceChannel.id}/voice-status`,
                    { status: statusText },
                    {
                      headers: {
                        Authorization: `Bot ${client.token}`,
                        'Content-Type': 'application/json',
                      },
                    }
                  );
                }
              } catch (errVS) {
                console.error('❌ Failed to set voice status:', errVS?.response?.data || errVS.message);
              }
            } catch (err) {
              console.error('❌ Failed to move user into new voice channel:', err.message);
            }
          } else {
            // user left before move; cleanup
            try {
              await newVoiceChannel.delete('User left before being moved into temp VC.');
              db.run(`DELETE FROM temp_channels WHERE channel_id = ?`, [newVoiceChannel.id], (e) => {
                if (e) console.error('Failed to delete temp channel from DB:', e);
              });
            } catch (err) {
              console.error('Error deleting temp channel after user left:', err.message);
            }
            return;
          }

          // save temp VC ownership
          db.run(
            `INSERT OR REPLACE INTO temp_channels (channel_id, owner_id, guild_id) VALUES (?, ?, ?)`,
            [newVoiceChannel.id, userId, guildId],
            (e) => {
              if (e) console.error('Failed to save temp channel:', e);
            }
          );

          // auto-delete if empty after creation
          setTimeout(async () => {
            const stillExists = newVoiceChannel.guild.channels.cache.has(newVoiceChannel.id);
            if (stillExists && newVoiceChannel.members.size === 0) {
              try {
                await newVoiceChannel.delete('Empty temp VC after 3s');
                db.run(
                  `DELETE FROM temp_channels WHERE channel_id = ?`,
                  [newVoiceChannel.id],
                  (er) => {
                    if (er) console.error('Failed to remove temp channel from DB:', er);
                  }
                );
              } catch (error) {
                console.error('Auto-delete error:', error);
              }
            }
          }, 3000);

          // panel (note: voice channels don't officially support send(); keep it where you post UI)
          const guild = newState.guild;
          const bannerURL =
            guild?.bannerURL({ size: 2048, dynamic: true }) ||
            guild?.splashURL({ size: 2048 }) ||
            guild?.iconURL({ size: 1024, dynamic: true }) ||
            null;

          const embed = new EmbedBuilder()
            .setDescription(
              `<a:ALG_jinx_Heart:1388922205429039114>  Heeey  <@${userId}>\n\n**Your personal voice control Hub — crafted for seamless management, effortless control, and a premium experience.
Welcome to Switzerland** — where your voice space truly belongs to you. \n\n> <:icons8cmd64:1396276488625586197>   Powered by Zaw  <@1202396567093387327> & <@1033812944879898736> `
            )
            .setThumbnail(newState.member.user.displayAvatarURL({ dynamic: true, size: 64 }))
            .setImage(bannerURL)
            .setColor('#2b2d31');

          if (bannerURL) embed.setImage(bannerURL);

          const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('lock')
              .setLabel('Lock')
              .setEmoji('<:black_lock:1391080843577131221>')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('unlock')
              .setLabel('Unlock')
              .setEmoji('<:closed76:1391080892604350625>')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('claim')
              .setLabel('Owner')
              .setEmoji('<:crown_drax:1391070112756531320>')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('setVoiceLimit')
              .setLabel('Limit')
              .setEmoji('<:e1790a519413e9689d274a84e3671ac6:1396276479347789936>')
              .setStyle(ButtonStyle.Secondary)
          );

          const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('permit')
              .setLabel('Permit')
              .setEmoji('<:true:1391089517783678986>')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('deny')
              .setLabel('Deny')
              .setEmoji('<:false:1391089516432850984>')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('name')
              .setLabel('Rename')
              .setEmoji('<:icons8edit64:1396276486679298210>')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('trash')
              .setLabel('Clear Msgs')
              .setEmoji('<:trash:1391088366602162250>')
              .setStyle(ButtonStyle.Danger)
          );

          const row3 = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('features_menu')
              .setPlaceholder('🔥 Other Options')
              .addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel('sb - ON')
                  .setValue('soundboard_on')
                  .setEmoji('<:arcadiasbon:1384183874405273681>'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('sb - OFF')
                  .setValue('soundboard_off')
                  .setEmoji('<:arcadiasboff:1401751570508419223>'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Cam - ON')
                  .setValue('camera_on')
                  .setEmoji('<:arcadiacamon:1401751735508144250>'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Cam - OFF')
                  .setValue('camera_off')
                  .setEmoji('<:arcadiacamoff:1401751870430515211>'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Activities - ON')
                  .setValue('activities_on')
                  .setEmoji('<:acradiaacton:1401752018158096566>'),
                new StringSelectMenuOptionBuilder()
                  .setLabel('Activities - OFF')
                  .setValue('activities_off')
                  .setEmoji('<:arcadiaactoff:1401752186009948163>')
              )
          );

          // NOTE: if you actually post this panel in a text channel, do it from your command handler.
          await newVoiceChannel.send({
            content: `<@${userId}>`,
            embeds: [embed],
            components: [row1, row2, row3],
          });
        } catch (error) {
          console.error('Error creating temp voice channel:', error);
        }
      }

      // Delete empty temp channel if owner left
      if (oldState.channelId) {
        db.get(
          `SELECT owner_id FROM temp_channels WHERE channel_id = ?`,
          [oldState.channelId],
          async (err, tempRow) => {
            if (err) return console.error(err);
            if (!tempRow) return;

            const tempChannel = oldState.guild.channels.cache.get(oldState.channelId);
            if (!tempChannel) {
              db.run(`DELETE FROM temp_channels WHERE channel_id = ?`, [oldState.channelId], (e) => {
                if (e) console.error('Failed to delete temp channel from DB:', e);
              });
              return;
            }

            if (tempChannel.members.size === 0) {
              try {
                await tempChannel.delete('Temp voice channel empty, deleting...');
                db.run(`DELETE FROM temp_channels WHERE channel_id = ?`, [oldState.channelId], (e) => {
                  if (e) console.error('Failed to delete temp channel from DB:', e);
                });
              } catch (error) {
                console.error('Failed to delete temp voice channel:', error);
              }
            }
          }
        );
      }
    });
  },
};
