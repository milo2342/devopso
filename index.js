require('dotenv').config();

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { DateTime } = require('luxon');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const TIMEZONE = process.env.TIMEZONE || 'America/New_York';
const DATA_PATH = path.resolve(process.env.BOT_DATA_PATH || path.join(__dirname, 'bot-data.json'));

if (!TOKEN) throw new Error('Missing DISCORD_TOKEN.');
if (!CLIENT_ID) throw new Error('Missing DISCORD_CLIENT_ID.');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const DEFAULT_DATA = {
  syncRoles: [],
  guilds: {},
  tickets: {},
  qaSubmissions: {},
  transfers: [],
  transferPosts: {},
};

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_PATH)) return cloneDefault();
    const parsed = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    return {
      ...cloneDefault(),
      ...parsed,
      syncRoles: Array.isArray(parsed.syncRoles) ? parsed.syncRoles : [],
      guilds: parsed.guilds && typeof parsed.guilds === 'object' ? parsed.guilds : {},
      tickets: parsed.tickets && typeof parsed.tickets === 'object' ? parsed.tickets : {},
      qaSubmissions: parsed.qaSubmissions && typeof parsed.qaSubmissions === 'object' ? parsed.qaSubmissions : {},
      transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
      transferPosts: parsed.transferPosts && typeof parsed.transferPosts === 'object' ? parsed.transferPosts : {},
    };
  } catch (error) {
    console.error(`Could not load ${DATA_PATH}:`, error);
    return cloneDefault();
  }
}

let data = loadData();

function saveData() {
  const dir = path.dirname(DATA_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const temp = `${DATA_PATH}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, DATA_PATH);
}

function guildConfig(guildId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      developerRoleIds: [],
      qaRoleIds: [],
      leoHandlerRoleIds: [],
      liveryHandlerRoleIds: [],
      commissionHandlerRoleIds: [],
      qaTicketHandlerRoleIds: [],
      transferRoleIds: [],
      leoCategoryId: null,
      liveryCategoryId: null,
      commissionCategoryId: null,
      qaTicketCategoryId: null,
      qaChannelId: null,
      transferChannelId: null,
      ticketLogChannelId: null,
      qaLogChannelId: null,
      transferLogChannelId: null,
      configLogChannelId: null,
      roleSyncLogChannelId: null,
      logChannelId: null,
    };
    saveData();
  }
  const config = data.guilds[guildId];
  const defaults = {
    developerRoleIds: [], qaRoleIds: [], leoHandlerRoleIds: [], liveryHandlerRoleIds: [],
    commissionHandlerRoleIds: [], qaTicketHandlerRoleIds: [], transferRoleIds: [],
    leoCategoryId: null, liveryCategoryId: null, commissionCategoryId: null, qaTicketCategoryId: null,
    qaChannelId: null, transferChannelId: null, ticketLogChannelId: null, qaLogChannelId: null,
    transferLogChannelId: null, configLogChannelId: null, roleSyncLogChannelId: null, logChannelId: null,
  };
  let changed = false;
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in config)) { config[key] = Array.isArray(value) ? [] : value; changed = true; }
  }
  if (changed) saveData();
  return config;
}

function cleanChannelName(value) {
  return String(value || 'ticket')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'ticket';
}

function shortId(prefix = '') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function truncate(value, max = 1024) {
  const text = String(value || 'Not provided');
  return text.length <= max ? text : `${text.slice(0, max - 3)}...`;
}

function roleIdsForType(config, type) {
  const map = {
    developer: config.developerRoleIds,
    qa: config.qaRoleIds,
    leo_handler: config.leoHandlerRoleIds,
    livery_handler: config.liveryHandlerRoleIds,
    commission_handler: config.commissionHandlerRoleIds,
    qa_ticket_handler: config.qaTicketHandlerRoleIds,
    transfer: config.transferRoleIds,
  };
  return Array.isArray(map[type]) ? map[type] : [];
}

function roleMentions(roleIds) {
  return [...new Set(roleIds || [])].map((id) => `<@&${id}>`).join(' ');
}

function configuredLogChannelId(config, type) {
  const map = {
    ticket: config.ticketLogChannelId || config.logChannelId,
    qa: config.qaLogChannelId || config.logChannelId,
    transfer: config.transferLogChannelId || config.logChannelId,
    config: config.configLogChannelId || config.logChannelId,
    role_sync: config.roleSyncLogChannelId || config.logChannelId,
  };
  return map[type] || null;
}

async function sendConfiguredLog(guild, type, payload) {
  if (!guild) return null;
  const config = guildConfig(guild.id);
  const channelId = configuredLogChannelId(config, type);
  if (!channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return null;
  return channel.send(payload).catch((error) => {
    console.warn(`${type} log failed in ${guild.name}: ${error.message}`);
    return null;
  });
}

function auditEmbed(title, actor, fields = []) {
  const embed = new EmbedBuilder().setTitle(title).setTimestamp();
  if (actor?.id) embed.setDescription(`Action by <@${actor.id}> (${actor.id})`);
  if (fields.length) embed.addFields(fields);
  return embed;
}

function hasAnyRole(member, roleIds) {
  return Boolean(member?.roles?.cache && roleIds.some((id) => member.roles.cache.has(id)));
}

function isAdmin(interactionOrMember) {
  const member = interactionOrMember?.member || interactionOrMember;
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
}

function isDeveloper(member) {
  if (!member?.guild) return false;
  if (isAdmin(member)) return true;
  return hasAnyRole(member, guildConfig(member.guild.id).developerRoleIds);
}

function isQA(member) {
  if (!member?.guild) return false;
  if (isAdmin(member)) return true;
  return hasAnyRole(member, guildConfig(member.guild.id).qaRoleIds);
}

function isTransferManager(member) {
  if (!member?.guild) return false;
  if (isAdmin(member)) return true;
  const config = guildConfig(member.guild.id);
  const roles = config.transferRoleIds.length ? config.transferRoleIds : config.developerRoleIds;
  return hasAnyRole(member, roles);
}

function exactRoleByName(guild, roleName) {
  return guild.roles.cache
    .filter((role) => role.id !== guild.id && !role.managed && role.name === roleName)
    .sort((a, b) => b.position - a.position)
    .first() || null;
}

function manageableRoleByName(guild, roleName) {
  return guild.roles.cache
    .filter((role) => role.id !== guild.id && !role.managed && role.name === roleName && role.editable)
    .sort((a, b) => b.position - a.position)
    .first() || null;
}

function memberHasRoleName(member, roleName) {
  return member.roles.cache.some((role) => role.id !== member.guild.id && role.name === roleName);
}

async function fetchMember(guild, userId) {
  return guild.members.cache.get(userId) || guild.members.fetch(userId).catch(() => null);
}

const roleSyncLocks = new Map();

function syncLockKey(guildId, userId, roleName) {
  return `${guildId}:${userId}:${roleName}`;
}

function setSyncLock(guildId, userId, roleName) {
  const key = syncLockKey(guildId, userId, roleName);
  roleSyncLocks.set(key, Date.now() + 15000);
  setTimeout(() => roleSyncLocks.delete(key), 16000).unref?.();
}

function hasSyncLock(guildId, userId, roleName) {
  const key = syncLockKey(guildId, userId, roleName);
  const until = roleSyncLocks.get(key);
  if (!until) return false;
  if (Date.now() > until) {
    roleSyncLocks.delete(key);
    return false;
  }
  return true;
}

async function propagateRole(sourceGuildId, userId, roleName, shouldHaveRole) {
  const results = { changed: 0, skipped: 0, errors: 0 };
  for (const guild of client.guilds.cache.values()) {
    if (guild.id === sourceGuildId) continue;
    const member = await fetchMember(guild, userId);
    if (!member || member.user.bot) continue;

    const role = manageableRoleByName(guild, roleName);
    if (!role) {
      results.skipped += 1;
      continue;
    }

    const hasRole = member.roles.cache.has(role.id);
    if (hasRole === shouldHaveRole) continue;

    try {
      setSyncLock(guild.id, userId, roleName);
      if (shouldHaveRole) {
        await member.roles.add(role, `Cross-server role sync from guild ${sourceGuildId}`);
      } else {
        await member.roles.remove(role, `Cross-server role sync from guild ${sourceGuildId}`);
      }
      results.changed += 1;
      await sendConfiguredLog(guild, 'role_sync', {
        embeds: [auditEmbed('Cross-Server Role Sync', { id: userId }, [
          { name: 'Action', value: shouldHaveRole ? 'Role Added' : 'Role Removed', inline: true },
          { name: 'Role', value: roleName, inline: true },
          { name: 'Member', value: `<@${userId}> (${userId})`, inline: false },
          { name: 'Source Guild ID', value: sourceGuildId, inline: true },
          { name: 'Target Guild', value: `${guild.name} (${guild.id})`, inline: true },
        ])],
      });
    } catch (error) {
      results.errors += 1;
      console.warn(`Role sync failed for ${userId}, ${roleName}, ${guild.name}: ${error.message}`);
    }
  }
  return results;
}

async function findOtherRoleSource(sourceGuildId, userId, roleName) {
  for (const guild of client.guilds.cache.values()) {
    if (guild.id === sourceGuildId) continue;
    const member = await fetchMember(guild, userId);
    if (member && !member.user.bot && memberHasRoleName(member, roleName)) return guild;
  }
  return null;
}

async function backfillRoleFromSourceGuild(guild, roleId, roleName) {
  const members = await guild.members.fetch().catch(() => null);
  if (!members) return { scanned: 0, changed: 0, errors: 0 };
  let scanned = 0;
  let changed = 0;
  let errors = 0;
  for (const member of members.values()) {
    if (member.user.bot || !member.roles.cache.has(roleId)) continue;
    scanned += 1;
    const result = await propagateRole(guild.id, member.id, roleName, true);
    changed += result.changed;
    errors += result.errors;
  }
  return { scanned, changed, errors };
}

async function syncMemberOnJoin(member) {
  if (member.user.bot) return;
  for (const roleName of data.syncRoles) {
    let sourceFound = false;
    for (const guild of client.guilds.cache.values()) {
      if (guild.id === member.guild.id) continue;
      const other = await fetchMember(guild, member.id);
      if (other && memberHasRoleName(other, roleName)) {
        sourceFound = true;
        break;
      }
    }
    if (!sourceFound) continue;

    const role = manageableRoleByName(member.guild, roleName);
    if (!role || member.roles.cache.has(role.id)) continue;
    try {
      setSyncLock(member.guild.id, member.id, roleName);
      await member.roles.add(role, `Cross-server role sync on guild join`);
      await sendConfiguredLog(member.guild, 'role_sync', {
        embeds: [auditEmbed('Cross-Server Role Sync', member.user, [
          { name: 'Action', value: 'Role Added on Join', inline: true },
          { name: 'Role', value: roleName, inline: true },
          { name: 'Member', value: `<@${member.id}> (${member.id})`, inline: false },
        ])],
      });
    } catch (error) {
      console.warn(`Join sync failed for ${member.user.tag}, ${roleName}: ${error.message}`);
    }
  }
}

async function backfillMember(userId) {
  const members = [];
  for (const guild of client.guilds.cache.values()) {
    const member = await fetchMember(guild, userId);
    if (member && !member.user.bot) members.push(member);
  }

  const sourceRoles = new Set();
  for (const roleName of data.syncRoles) {
    if (members.some((member) => memberHasRoleName(member, roleName))) sourceRoles.add(roleName);
  }

  let added = 0;
  for (const member of members) {
    for (const roleName of sourceRoles) {
      const role = manageableRoleByName(member.guild, roleName);
      if (!role || member.roles.cache.has(role.id)) continue;
      try {
        setSyncLock(member.guild.id, userId, roleName);
        await member.roles.add(role, 'Manual cross-server role synchronization');
        added += 1;
      } catch (error) {
        console.warn(`Backfill failed in ${member.guild.name}: ${error.message}`);
      }
    }
  }
  return { mutualGuilds: members.length, added, roles: [...sourceRoles] };
}

function ticketModal(type) {
  const definitions = {
    leo: {
      title: 'LEO Development Request',
      fields: [
        ['agency', 'Agency / Department', TextInputStyle.Short, 'Which LEO agency is this request for?', true],
        ['request', 'Requested Asset or Change', TextInputStyle.Paragraph, 'Describe what you need developed or changed.', true],
        ['purpose', 'Purpose / Use Case', TextInputStyle.Paragraph, 'Explain how this will be used in the server.', true],
        ['references', 'References / Links', TextInputStyle.Paragraph, 'Reference images, documents, models, links, etc.', false],
        ['details', 'Technical Details', TextInputStyle.Paragraph, 'Any spawn codes, requirements, compatibility notes, etc.', false],
      ],
    },
    livery: {
      title: 'Livery Development Request',
      fields: [
        ['vehicle', 'Vehicle / Model', TextInputStyle.Short, 'Vehicle name or spawn code.', true],
        ['request', 'Livery Request', TextInputStyle.Paragraph, 'Describe the livery you need.', true],
        ['branding', 'Branding / Style Requirements', TextInputStyle.Paragraph, 'Colors, agency markings, unit style, etc.', true],
        ['references', 'Reference Material', TextInputStyle.Paragraph, 'Links to reference images or examples.', false],
        ['details', 'Additional Requirements', TextInputStyle.Paragraph, 'Any other information for the developer.', false],
      ],
    },
    commission: {
      title: 'Custom Development Commission',
      fields: [
        ['type', 'Commission Type', TextInputStyle.Short, 'Vehicle, livery, map, script, EUP, etc.', true],
        ['request', 'Requested Work', TextInputStyle.Paragraph, 'Describe exactly what you want commissioned.', true],
        ['requirements', 'Requirements / Specifications', TextInputStyle.Paragraph, 'List required features and specifications.', true],
        ['references', 'Reference Material', TextInputStyle.Paragraph, 'Links, images, documents, examples, etc.', false],
        ['timeline', 'Timeline / Priority', TextInputStyle.Short, 'Desired completion date or urgency.', false],
      ],
    },
    qa: {
      title: 'Quality Assurance Ticket',
      fields: [
        ['item', 'Item / Resource Being Tested', TextInputStyle.Short, 'Vehicle, YMAP, script, livery, etc.', true],
        ['issue', 'QA Request / Issue', TextInputStyle.Paragraph, 'What needs to be tested or reviewed?', true],
        ['expected', 'Expected Behaviour', TextInputStyle.Paragraph, 'What should happen when working correctly?', true],
        ['steps', 'Testing Steps', TextInputStyle.Paragraph, 'Steps to reproduce or validate the item.', false],
        ['evidence', 'Evidence / Links', TextInputStyle.Paragraph, 'Screenshots, clips, files, PRs, etc.', false],
      ],
    },
  };

  const def = definitions[type];
  if (!def) return null;
  const modal = new ModalBuilder().setCustomId(`ticket_modal:${type}`).setTitle(def.title);
  for (const [id, label, style, placeholder, required] of def.fields) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style)
        .setPlaceholder(placeholder)
        .setRequired(required),
    ));
  }
  return modal;
}

function ticketTitle(type) {
  return {
    leo: 'LEO Development Ticket',
    livery: 'Livery Development Ticket',
    commission: 'Custom Development Commission',
    qa: 'Quality Assurance Ticket',
  }[type] || 'Development Ticket';
}

function ticketCategoryId(config, type) {
  return {
    leo: config.leoCategoryId,
    livery: config.liveryCategoryId,
    commission: config.commissionCategoryId,
    qa: config.qaTicketCategoryId,
  }[type] || null;
}

function ticketHandlerRoleIds(config, type) {
  const configured = {
    leo: config.leoHandlerRoleIds,
    livery: config.liveryHandlerRoleIds,
    commission: config.commissionHandlerRoleIds,
    qa: config.qaTicketHandlerRoleIds,
  }[type] || [];
  if (configured.length) return configured;
  return type === 'qa' ? config.qaRoleIds : config.developerRoleIds;
}

async function createTicketFromModal(interaction, type) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guild = interaction.guild;
  const config = guildConfig(guild.id);
  const handlerRoleIds = ticketHandlerRoleIds(config, type).filter((id) => guild.roles.cache.has(id));
  const categoryId = ticketCategoryId(config, type);

  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
    },
  ];

  for (const roleId of handlerRoleIds) {
    if (guild.roles.cache.has(roleId)) {
      permissionOverwrites.push({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks],
      });
    }
  }

  const channel = await guild.channels.create({
    name: `${type}-${cleanChannelName(interaction.user.username)}`,
    type: ChannelType.GuildText,
    parent: categoryId || undefined,
    permissionOverwrites,
    reason: `${ticketTitle(type)} opened by ${interaction.user.tag}`,
  });

  const fieldLabels = {
    agency: 'Agency / Department',
    request: 'Request',
    purpose: 'Purpose / Use Case',
    references: 'References / Links',
    details: 'Technical Details',
    vehicle: 'Vehicle / Model',
    branding: 'Branding / Style Requirements',
    type: 'Commission Type',
    requirements: 'Requirements / Specifications',
    timeline: 'Timeline / Priority',
    item: 'Item / Resource',
    issue: 'QA Request / Issue',
    expected: 'Expected Behaviour',
    steps: 'Testing Steps',
    evidence: 'Evidence / Links',
  };

  const fields = [];
  for (const [key, label] of Object.entries(fieldLabels)) {
    let value;
    try { value = interaction.fields.getTextInputValue(key); } catch { value = null; }
    if (value) fields.push({ name: label, value: truncate(value), inline: false });
  }

  const embed = new EmbedBuilder()
    .setTitle(ticketTitle(type))
    .setDescription(`Opened by <@${interaction.user.id}>`)
    .addFields(fields)
    .setTimestamp();

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_close:${channel.id}`).setLabel('Close Ticket').setStyle(ButtonStyle.Secondary),
  );

  const handlerPing = roleMentions(handlerRoleIds);
  const message = await channel.send({
    content: handlerPing || undefined,
    embeds: [embed],
    components: [controls],
    allowedMentions: { roles: handlerRoleIds },
  });

  data.tickets[channel.id] = {
    guildId: guild.id,
    channelId: channel.id,
    openerId: interaction.user.id,
    type,
    messageId: message.id,
    status: 'open',
    createdAt: Date.now(),
    closedAt: null,
  };
  saveData();

  await sendConfiguredLog(guild, 'ticket', {
    embeds: [auditEmbed('Development Ticket Opened', interaction.user, [
      { name: 'Type', value: ticketTitle(type), inline: true },
      { name: 'Channel', value: `<#${channel.id}> (${channel.id})`, inline: true },
      { name: 'Opened By', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Handler Roles', value: handlerRoleIds.length ? handlerRoleIds.map((id) => `<@&${id}>`).join(', ') : 'Fallback/default team roles' },
    ])],
  });

  await interaction.editReply(`Ticket created: <#${channel.id}>`);
}

async function makeTranscript(channel) {
  const messages = [];
  let before;
  for (let page = 0; page < 20; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch?.size) break;
    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = [];
  for (const message of messages) {
    lines.push(`[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag} (${message.author.id})`);
    if (message.content) lines.push(message.content);
    for (const embed of message.embeds) {
      if (embed.title) lines.push(`EMBED TITLE: ${embed.title}`);
      if (embed.description) lines.push(`EMBED DESCRIPTION: ${embed.description}`);
      for (const field of embed.fields || []) lines.push(`${field.name}: ${field.value}`);
    }
    if (message.attachments.size) lines.push(`Attachments: ${[...message.attachments.values()].map((a) => a.url).join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function logTicketTranscript(channel, ticket, action, actor) {
  const config = guildConfig(channel.guild.id);
  const logChannelId = configuredLogChannelId(config, 'ticket');
  if (!logChannelId) return;
  const logChannel = await channel.guild.channels.fetch(logChannelId).catch(() => null);
  if (!logChannel?.isTextBased()) return;
  const transcript = await makeTranscript(channel);
  const buffer = Buffer.from(transcript || 'No transcript content.', 'utf8');
  await logChannel.send({
    content: `${ticketTitle(ticket.type)} ${action} by ${actor.tag} (${actor.id})\nChannel: ${channel.name} (${channel.id})`,
    files: [{ attachment: buffer, name: `${cleanChannelName(channel.name)}-transcript.txt` }],
  }).catch((error) => console.warn(`Transcript log failed: ${error.message}`));
}

async function closeTicket(interaction, channelId) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.guild) return interaction.editReply('Ticket channel not found.');
  const ticket = data.tickets[channelId];
  if (!ticket) return interaction.editReply('This channel is not registered as a development ticket.');
  const member = interaction.member;
  const config = guildConfig(channel.guild.id);
  const handlerIds = ticketHandlerRoleIds(config, ticket.type);
  const allowed = interaction.user.id === ticket.openerId || isAdmin(member) || hasAnyRole(member, handlerIds);
  if (!allowed) return interaction.editReply('You do not have permission to close this ticket.');

  if (ticket.status === 'closed') return interaction.editReply('This ticket is already closed.');
  ticket.status = 'closed';
  ticket.closedAt = Date.now();
  saveData();

  await logTicketTranscript(channel, ticket, 'closed', interaction.user);

  await channel.permissionOverwrites.edit(ticket.openerId, { SendMessages: false }).catch(() => null);
  const closedEmbed = new EmbedBuilder()
    .setTitle('Ticket Closed')
    .setDescription(`Closed by <@${interaction.user.id}>.\nUse the Delete Ticket button when the ticket is no longer needed.`)
    .setTimestamp();
  const deleteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_delete:${channel.id}`).setLabel('Delete Ticket').setStyle(ButtonStyle.Danger),
  );
  await channel.send({ embeds: [closedEmbed], components: [deleteRow] });
  await interaction.editReply('Ticket closed.');
}

async function deleteTicket(interaction, channelId) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.guild) return interaction.editReply('Ticket channel not found.');
  const ticket = data.tickets[channelId];
  if (!ticket) return interaction.editReply('This channel is not registered as a development ticket.');
  const config = guildConfig(channel.guild.id);
  const handlerIds = ticketHandlerRoleIds(config, ticket.type);
  if (!isAdmin(interaction.member) && !hasAnyRole(interaction.member, handlerIds)) {
    return interaction.editReply('Only the configured ticket handler team can delete tickets.');
  }
  if (ticket.status !== 'closed') return interaction.editReply('Close this ticket before deleting it.');

  await logTicketTranscript(channel, ticket, 'deleted', interaction.user);
  delete data.tickets[channelId];
  saveData();
  await interaction.editReply('Deleting ticket...');
  setTimeout(() => channel.delete(`Deleted by ${interaction.user.tag}`).catch(() => null), 1200).unref?.();
}

function qaStatusEmbed(submission) {
  const embed = new EmbedBuilder()
    .setTitle(submission.kind === 'vehicle' ? 'Vehicle Quality Assurance Submission' : 'YMAP Quality Assurance Submission')
    .setDescription(`Submitted by <@${submission.submitterId}>`)
    .addFields(
      { name: 'Status', value: submission.status, inline: true },
      { name: submission.kind === 'vehicle' ? 'Spawn Code' : 'Resource / Map', value: submission.identifier, inline: true },
    )
    .setTimestamp(new Date(submission.createdAt));

  if (submission.displayName) embed.addFields({ name: 'Name', value: truncate(submission.displayName), inline: true });
  if (submission.kind === 'vehicle') embed.addFields({ name: 'Flags', value: submission.flags.length ? submission.flags.join(', ') : 'None', inline: false });
  if (submission.location) embed.addFields({ name: 'Location', value: truncate(submission.location), inline: false });
  if (submission.notes) embed.addFields({ name: 'Developer Notes', value: truncate(submission.notes), inline: false });
  if (submission.reviewedBy) {
    embed.addFields(
      { name: 'Reviewed By', value: `<@${submission.reviewedBy}>`, inline: true },
      { name: 'Review Reason', value: truncate(submission.reviewReason || 'No reason provided.'), inline: false },
    );
  }
  return embed;
}

function qaReviewButtons(submissionId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`qa_review:approve:${submissionId}`).setLabel('Approve').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`qa_review:deny:${submissionId}`).setLabel('Denied').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

function qaResultEmbed(submission) {
  const approved = submission.status === 'Approved';
  const kindLabel = submission.kind === 'vehicle' ? 'Vehicle' : 'YMAP';
  const embed = new EmbedBuilder()
    .setTitle(`${kindLabel} ${approved ? 'Approved' : 'Denied'}`)
    .setDescription(
      approved
        ? `Quality Assurance approved this ${kindLabel.toLowerCase()} submission. It can now be marked for the next development transfer.`
        : `Quality Assurance denied this ${kindLabel.toLowerCase()} submission. Review the reason below before resubmitting.`,
    )
    .addFields(
      { name: submission.kind === 'vehicle' ? 'Spawn Code' : 'Resource / Map', value: `\`${truncate(submission.identifier, 200)}\``, inline: true },
      { name: 'Submitted By', value: `<@${submission.submitterId}>`, inline: true },
      { name: 'Reviewed By', value: `<@${submission.reviewedBy}>`, inline: true },
      { name: 'QA Reason', value: truncate(submission.reviewReason || 'No reason provided.'), inline: false },
    )
    .setTimestamp(new Date(submission.reviewedAt || Date.now()));
  if (submission.displayName) embed.addFields({ name: 'Name', value: truncate(submission.displayName), inline: true });
  if (submission.kind === 'vehicle') embed.addFields({ name: 'Flags', value: submission.flags?.length ? submission.flags.join(', ') : 'None', inline: false });
  return embed;
}

function markTransferButton(submissionId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`qa_transfer:${submissionId}`)
      .setLabel(disabled ? 'Marked for Transfer' : 'Mark for Transfer')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

async function postQASubmission(guild, submission) {
  const config = guildConfig(guild.id);
  if (!config.qaChannelId) throw new Error('No Quality Assurance channel configured. Use /dev-config set-channel with Quality Assurance Submissions.');
  const channel = await guild.channels.fetch(config.qaChannelId).catch(() => null);
  if (!channel?.isTextBased()) throw new Error('The configured Quality Assurance channel is unavailable.');
  const qaRoleIds = config.qaRoleIds.filter((id) => guild.roles.cache.has(id));
  const qaPing = roleMentions(qaRoleIds);
  const message = await channel.send({
    content: qaPing || undefined,
    embeds: [qaStatusEmbed(submission)],
    components: [qaReviewButtons(submission.id)],
    allowedMentions: { roles: qaRoleIds },
  });
  submission.channelId = channel.id;
  submission.messageId = message.id;
  data.qaSubmissions[submission.id] = submission;
  saveData();

  await sendConfiguredLog(guild, 'qa', {
    embeds: [auditEmbed('QA Submission Created', { id: submission.submitterId }, [
      { name: 'Type', value: submission.kind === 'vehicle' ? 'Vehicle' : 'YMAP', inline: true },
      { name: 'Identifier', value: `\`${truncate(submission.identifier, 200)}\``, inline: true },
      { name: 'QA Message', value: `[Open Submission](${message.url})`, inline: false },
      { name: 'Source Channel', value: submission.sourceChannelId ? `<#${submission.sourceChannelId}>` : 'Unknown', inline: true },
    ])],
  });
  return message;
}

const pendingVehicle = new Map();

function vehicleFlagMenu(key) {
  const options = [
    ['Bulletproof', 'bulletproof'],
    ['Bulletproof Tires', 'bulletproof_tires'],
    ['Nitrous', 'nitrous'],
    ['Armored', 'armored'],
    ['Weaponized', 'weaponized'],
    ['Custom Handling', 'custom_handling'],
    ['Emergency Lighting / ELS', 'emergency_lighting'],
    ['Custom Audio', 'custom_audio'],
    ['Drift Setup', 'drift'],
    ['No Special Flags', 'none'],
  ].map(([label, value]) => new StringSelectMenuOptionBuilder().setLabel(label).setValue(value));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`vehicle_flags:${key}`)
      .setPlaceholder('Select all flags that apply...')
      .setMinValues(1)
      .setMaxValues(options.length)
      .addOptions(options),
  );
}

async function reviewQASubmission(interaction, decision, submissionId) {
  const submission = data.qaSubmissions[submissionId];
  if (!submission || submission.guildId !== interaction.guildId) {
    return interaction.reply({ content: 'QA submission not found.', flags: MessageFlags.Ephemeral });
  }
  if (!isQA(interaction.member)) {
    return interaction.reply({ content: 'Only the configured Quality Assurance team can review this submission.', flags: MessageFlags.Ephemeral });
  }
  if (submission.status !== 'Pending QA') {
    return interaction.reply({ content: `This submission is already ${submission.status}.`, flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`qa_review_modal:${decision}:${submissionId}`)
    .setTitle(decision === 'approve' ? 'Approve QA Submission' : 'Deny QA Submission')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Review reason / findings')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Explain the QA result and any required changes.')
          .setRequired(true),
      ),
    );
  await interaction.showModal(modal);
}

async function finalizeQAReview(interaction, decision, submissionId) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const submission = data.qaSubmissions[submissionId];
  if (!submission || submission.guildId !== interaction.guildId) return interaction.editReply('QA submission not found.');
  if (!isQA(interaction.member)) return interaction.editReply('Only the configured Quality Assurance team can review this submission.');
  if (submission.status !== 'Pending QA') return interaction.editReply(`This submission is already ${submission.status}.`);

  submission.status = decision === 'approve' ? 'Approved' : 'Denied';
  submission.reviewedBy = interaction.user.id;
  submission.reviewReason = interaction.fields.getTextInputValue('reason');
  submission.reviewedAt = Date.now();
  saveData();

  const qaChannel = await interaction.guild.channels.fetch(submission.channelId).catch(() => null);
  const qaMessage = qaChannel?.isTextBased() ? await qaChannel.messages.fetch(submission.messageId).catch(() => null) : null;
  if (qaMessage) {
    await qaMessage.edit({ embeds: [qaStatusEmbed(submission)], components: [qaReviewButtons(submission.id, true)] });
    let thread = qaMessage.thread;
    if (!thread) {
      thread = await qaMessage.startThread({
        name: `QA Proof - ${cleanChannelName(submission.identifier).slice(0, 70)}`,
        autoArchiveDuration: 10080,
        reason: `QA proof thread for ${submission.identifier}`,
      }).catch(() => null);
    }
    if (thread) {
      submission.threadId = thread.id;
      saveData();
      await thread.send(
        `<@${interaction.user.id}> reviewed this submission as **${submission.status}**.\n` +
        `Reason: ${submission.reviewReason}\n\nUpload screenshots, clips, test results, or other QA proof in this thread.`,
      ).catch(() => null);
    }
  }

  let resultMessage = null;
  if (submission.sourceChannelId) {
    const sourceChannel = await interaction.guild.channels.fetch(submission.sourceChannelId).catch(() => null);
    if (sourceChannel?.isTextBased()) {
      resultMessage = await sourceChannel.send({
        content: `<@${submission.submitterId}>`,
        embeds: [qaResultEmbed(submission)],
        components: submission.status === 'Approved' ? [markTransferButton(submission.id)] : [],
        allowedMentions: { users: [submission.submitterId] },
      }).catch(() => null);
      if (resultMessage) {
        submission.resultChannelId = resultMessage.channelId;
        submission.resultMessageId = resultMessage.id;
        saveData();
      }
    }
  }

  await sendConfiguredLog(interaction.guild, 'qa', {
    embeds: [auditEmbed(`QA Submission ${submission.status}`, interaction.user, [
      { name: 'Type', value: submission.kind === 'vehicle' ? 'Vehicle' : 'YMAP', inline: true },
      { name: 'Identifier', value: `\`${truncate(submission.identifier, 200)}\``, inline: true },
      { name: 'Submitted By', value: `<@${submission.submitterId}>`, inline: true },
      { name: 'Reason', value: truncate(submission.reviewReason), inline: false },
      { name: 'Proof Thread', value: submission.threadId ? `<#${submission.threadId}>` : 'Thread could not be created', inline: true },
      { name: 'Origin Result', value: resultMessage ? `[Open Result](${resultMessage.url})` : 'Origin channel unavailable', inline: true },
    ])],
  });

  await interaction.editReply(`QA submission ${submission.status.toLowerCase()}. The original command channel was notified and a proof thread was created when possible.`);
}

async function createTransferFromSubmission(guild, submission, actor) {
  if (submission.transferId) {
    return data.transfers.find((item) => item.id === submission.transferId) || null;
  }
  const item = {
    id: shortId('tr_'),
    guildId: guild.id,
    developerId: actor.id,
    type: submission.kind === 'vehicle' ? 'Vehicle' : 'YMAP',
    name: submission.displayName || submission.identifier,
    identifier: submission.identifier,
    notes: `QA approved by ${submission.reviewedBy ? `<@${submission.reviewedBy}>` : 'Quality Assurance'}. QA submission: ${submission.id}`,
    sourceQaId: submission.id,
    status: 'pending',
    createdAt: Date.now(),
    completedAt: null,
    completedBy: null,
  };
  data.transfers.push(item);
  submission.transferId = item.id;
  saveData();
  await sendConfiguredLog(guild, 'transfer', {
    embeds: [auditEmbed('Item Marked for Transfer', actor, [
      { name: 'Type', value: item.type, inline: true },
      { name: 'Name', value: truncate(item.name), inline: true },
      { name: 'Identifier', value: item.identifier ? `\`${truncate(item.identifier, 200)}\`` : 'N/A', inline: true },
      { name: 'Transfer ID', value: `\`${item.id}\``, inline: true },
      { name: 'Source QA', value: `\`${submission.id}\``, inline: true },
    ])],
  });
  return item;
}

function transferWeekKey(guildId, dt = DateTime.now().setZone(TIMEZONE)) {
  return `${guildId}:${dt.weekYear}-W${String(dt.weekNumber).padStart(2, '0')}`;
}

async function postTransferWindow(guild, manual = false) {
  const config = guildConfig(guild.id);
  if (!config.transferChannelId) return false;
  const channel = await guild.channels.fetch(config.transferChannelId).catch(() => null);
  if (!channel?.isTextBased()) return false;

  const pending = data.transfers.filter((item) => item.guildId === guild.id && item.status === 'pending');
  if (!pending.length && !manual) return false;

  const chunks = [];
  for (let i = 0; i < pending.length; i += 10) chunks.push(pending.slice(i, i + 10));
  if (!chunks.length) chunks.push([]);

  for (let i = 0; i < chunks.length; i += 1) {
    const embed = new EmbedBuilder()
      .setTitle(i === 0 ? 'Weekly Development Transfer Window' : 'Weekly Development Transfer Window (Continued)')
      .setDescription(
        chunks[i].length
          ? 'The following approved/development items are currently marked for the Saturday transfer.'
          : 'There are currently no pending items marked for this transfer window.',
      )
      .setTimestamp();
    for (const item of chunks[i]) {
      embed.addFields({
        name: `${item.type} - ${item.name}`,
        value: `ID: \`${item.id}\`\nIdentifier: ${item.identifier || 'N/A'}\nDeveloper: <@${item.developerId}>${item.notes ? `\nNotes: ${truncate(item.notes, 500)}` : ''}`,
        inline: false,
      });
    }
    await channel.send({ embeds: [embed] });
  }
  return true;
}

async function transferSchedulerTick() {
  const now = DateTime.now().setZone(TIMEZONE);
  if (now.weekday !== 6 || now.hour < 16) return;
  for (const guild of client.guilds.cache.values()) {
    const key = transferWeekKey(guild.id, now);
    if (data.transferPosts[key]) continue;
    const posted = await postTransferWindow(guild, false).catch((error) => {
      console.error(`Transfer scheduler failed for ${guild.name}:`, error);
      return false;
    });
    data.transferPosts[key] = posted ? Date.now() : 'empty';
    saveData();
    if (posted) {
      await sendConfiguredLog(guild, 'transfer', {
        embeds: [new EmbedBuilder().setTitle('Scheduled Transfer List Posted').setDescription('The Saturday 4:00 PM Eastern transfer list was posted automatically.').setTimestamp()],
      });
    }
  }
}

function developmentPanel() {
  const embed = new EmbedBuilder()
    .setTitle('WCRP Development Support')
    .setDescription('Select the type of development request you need. The button opens a guided form, then the bot creates a private ticket and routes it to the configured handler role for that ticket type.')
    .addFields(
      { name: 'LEO Ticket', value: 'Department assets, vehicle changes, emergency equipment, and other LEO development requests.', inline: false },
      { name: 'Livery Ticket', value: 'Vehicle livery design, revisions, branding, and texture requests.', inline: false },
      { name: 'Custom Commission', value: 'Custom vehicles, scripts, maps, EUP, liveries, and other development work.', inline: false },
      { name: 'Quality Assurance', value: 'Testing issues, validation requests, evidence, and QA support.', inline: false },
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_ticket:leo').setLabel('LEO Ticket').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('open_ticket:livery').setLabel('Livery Ticket').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('open_ticket:commission').setLabel('Custom Commission').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('open_ticket:qa').setLabel('Quality Assurance').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

const roleTypeChoices = [
  { name: 'Developer Command Access', value: 'developer' },
  { name: 'Quality Assurance Reviewer', value: 'qa' },
  { name: 'LEO Ticket Handler', value: 'leo_handler' },
  { name: 'Livery Ticket Handler', value: 'livery_handler' },
  { name: 'Commission Ticket Handler', value: 'commission_handler' },
  { name: 'QA Ticket Handler', value: 'qa_ticket_handler' },
  { name: 'Transfer Manager', value: 'transfer' },
];
const categoryTypeChoices = [
  { name: 'LEO Tickets', value: 'leo' },
  { name: 'Livery Tickets', value: 'livery' },
  { name: 'Custom Commissions', value: 'commission' },
  { name: 'Quality Assurance Tickets', value: 'qa' },
];
const channelTypeChoices = [
  { name: 'Quality Assurance Submissions', value: 'qa' },
  { name: 'Saturday Transfer', value: 'transfer' },
  { name: 'Ticket / Transcript Logs', value: 'ticket_log' },
  { name: 'Quality Assurance Logs', value: 'qa_log' },
  { name: 'Transfer Logs', value: 'transfer_log' },
  { name: 'Configuration Logs', value: 'config_log' },
  { name: 'Role Sync Logs', value: 'role_sync_log' },
  { name: 'Legacy / Fallback Log Channel', value: 'log' },
];

const commands = [
  new SlashCommandBuilder()
    .setName('syncrole')
    .setDescription('Configure exact role names synchronized across every server using this bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('add').setDescription('Add an exact role name to synchronization').addRoleOption((o) => o.setName('role').setDescription('Role whose exact name should sync').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Stop syncing an exact role name').addStringOption((o) => o.setName('name').setDescription('Exact role name').setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('List synced role names'))
    .addSubcommand((s) => s.setName('diagnose').setDescription('Check where a role exists and whether the bot can manage it').addStringOption((o) => o.setName('name').setDescription('Exact role name').setRequired(true))),

  new SlashCommandBuilder()
    .setName('syncmember')
    .setDescription('Backfill a member\'s synced roles across all mutual servers')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) => o.setName('user').setDescription('Member to synchronize').setRequired(true)),

  new SlashCommandBuilder()
    .setName('dev-config')
    .setDescription('Configure the WCRP development bot for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('add-role').setDescription('Add a team role').addStringOption((o) => o.setName('type').setDescription('Team').setRequired(true).addChoices(...roleTypeChoices)).addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand((s) => s.setName('remove-role').setDescription('Remove a team role').addStringOption((o) => o.setName('type').setDescription('Team').setRequired(true).addChoices(...roleTypeChoices)).addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand((s) => s.setName('set-category').setDescription('Set a ticket category').addStringOption((o) => o.setName('type').setDescription('Ticket type').setRequired(true).addChoices(...categoryTypeChoices)).addChannelOption((o) => o.setName('category').setDescription('Category').setRequired(true).addChannelTypes(ChannelType.GuildCategory)))
    .addSubcommand((s) => s.setName('set-channel').setDescription('Set a development channel').addStringOption((o) => o.setName('type').setDescription('Channel purpose').setRequired(true).addChoices(...channelTypeChoices)).addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('view').setDescription('View the development configuration')),

  new SlashCommandBuilder().setName('dev-panel').setDescription('Post the WCRP development ticket panel').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('approve-vehicle')
    .setDescription('Submit a vehicle to Quality Assurance for approval')
    .addStringOption((o) => o.setName('spawn_code').setDescription('Vehicle spawn code').setRequired(true))
    .addStringOption((o) => o.setName('vehicle_name').setDescription('Vehicle display name').setRequired(false))
    .addStringOption((o) => o.setName('other_flags').setDescription('Any additional flags not in the selector').setRequired(false))
    .addStringOption((o) => o.setName('notes').setDescription('Developer notes / testing requirements').setRequired(false)),

  new SlashCommandBuilder()
    .setName('approve-ymap')
    .setDescription('Submit a YMAP to Quality Assurance for approval')
    .addStringOption((o) => o.setName('resource').setDescription('Resource or YMAP name').setRequired(true))
    .addStringOption((o) => o.setName('map_name').setDescription('Human-readable map name').setRequired(false))
    .addStringOption((o) => o.setName('location').setDescription('In-game location').setRequired(false))
    .addStringOption((o) => o.setName('notes').setDescription('Developer notes / testing requirements').setRequired(false)),

  new SlashCommandBuilder()
    .setName('mark-for-transfer')
    .setDescription('Mark a development item for the Saturday 4 PM Eastern transfer')
    .addStringOption((o) => o.setName('type').setDescription('Item type').setRequired(true).addChoices(
      { name: 'Vehicle', value: 'Vehicle' },
      { name: 'YMAP', value: 'YMAP' },
      { name: 'Livery', value: 'Livery' },
      { name: 'EUP', value: 'EUP' },
      { name: 'Script', value: 'Script' },
      { name: 'Other', value: 'Other' },
    ))
    .addStringOption((o) => o.setName('name').setDescription('Item name').setRequired(true))
    .addStringOption((o) => o.setName('identifier').setDescription('Spawn code, resource name, file name, etc.').setRequired(false))
    .addStringOption((o) => o.setName('notes').setDescription('Transfer notes').setRequired(false)),

  new SlashCommandBuilder().setName('transfer-list').setDescription('List everything currently marked for transfer'),
  new SlashCommandBuilder()
    .setName('transfer-complete')
    .setDescription('Mark a transfer item as completed')
    .addStringOption((o) => o.setName('id').setDescription('Transfer item ID, or ALL').setRequired(true)),
  new SlashCommandBuilder().setName('transfer-post').setDescription('Manually post the current transfer list'),

  new SlashCommandBuilder().setName('ticket-close').setDescription('Close the current development ticket'),
  new SlashCommandBuilder().setName('ticket-delete').setDescription('Delete the current closed development ticket'),
  new SlashCommandBuilder().setName('ticket-add').setDescription('Add someone to the current development ticket').addUserOption((o) => o.setName('user').setDescription('User to add').setRequired(true)),
  new SlashCommandBuilder().setName('ticket-remove').setDescription('Remove someone from the current development ticket').addUserOption((o) => o.setName('user').setDescription('User to remove').setRequired(true)),
].map((command) => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const result = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log(`Registered ${Array.isArray(result) ? result.length : commands.length} global commands.`);
}

async function handleDevConfig(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.inGuild() || !isAdmin(interaction)) return interaction.editReply('Administrator permission is required.');
  const config = guildConfig(interaction.guildId);
  const sub = interaction.options.getSubcommand();

  if (sub === 'add-role' || sub === 'remove-role') {
    const type = interaction.options.getString('type', true);
    const role = interaction.options.getRole('role', true);
    const key = {
      developer: 'developerRoleIds', qa: 'qaRoleIds', leo_handler: 'leoHandlerRoleIds',
      livery_handler: 'liveryHandlerRoleIds', commission_handler: 'commissionHandlerRoleIds',
      qa_ticket_handler: 'qaTicketHandlerRoleIds', transfer: 'transferRoleIds',
    }[type];
    if (!key) return interaction.editReply('Unknown role configuration type.');
    if (sub === 'add-role') config[key] = [...new Set([...config[key], role.id])];
    else config[key] = config[key].filter((id) => id !== role.id);
    saveData();
    const label = roleTypeChoices.find((x) => x.value === type)?.name || type;
    await sendConfiguredLog(interaction.guild, 'config', {
      embeds: [auditEmbed('Development Configuration Changed', interaction.user, [
        { name: 'Setting', value: label, inline: true },
        { name: 'Action', value: sub === 'add-role' ? 'Role Added' : 'Role Removed', inline: true },
        { name: 'Role', value: `<@&${role.id}> (${role.id})`, inline: false },
      ])],
    });
    return interaction.editReply(`${label}: ${config[key].length ? config[key].map((id) => `<@&${id}>`).join(', ') : 'None'}`);
  }

  if (sub === 'set-category') {
    const type = interaction.options.getString('type', true);
    const category = interaction.options.getChannel('category', true);
    const key = { leo: 'leoCategoryId', livery: 'liveryCategoryId', commission: 'commissionCategoryId', qa: 'qaTicketCategoryId' }[type];
    if (!key) return interaction.editReply('Unknown ticket category type.');
    config[key] = category.id;
    saveData();
    const label = categoryTypeChoices.find((x) => x.value === type)?.name || type;
    await sendConfiguredLog(interaction.guild, 'config', {
      embeds: [auditEmbed('Development Configuration Changed', interaction.user, [
        { name: 'Setting', value: `${label} Category`, inline: true },
        { name: 'Channel', value: `<#${category.id}> (${category.id})`, inline: true },
      ])],
    });
    return interaction.editReply(`${label} category set to <#${category.id}>.`);
  }

  if (sub === 'set-channel') {
    const type = interaction.options.getString('type', true);
    const channel = interaction.options.getChannel('channel', true);
    const key = {
      qa: 'qaChannelId', transfer: 'transferChannelId', ticket_log: 'ticketLogChannelId',
      qa_log: 'qaLogChannelId', transfer_log: 'transferLogChannelId', config_log: 'configLogChannelId',
      role_sync_log: 'roleSyncLogChannelId', log: 'logChannelId',
    }[type];
    if (!key) return interaction.editReply('Unknown channel configuration type.');
    config[key] = channel.id;
    saveData();
    const label = channelTypeChoices.find((x) => x.value === type)?.name || type;
    await sendConfiguredLog(interaction.guild, 'config', {
      embeds: [auditEmbed('Development Configuration Changed', interaction.user, [
        { name: 'Setting', value: label, inline: true },
        { name: 'Channel', value: `<#${channel.id}> (${channel.id})`, inline: true },
      ])],
    });
    return interaction.editReply(`${label} channel set to <#${channel.id}>.`);
  }

  if (sub === 'view') {
    const showRoles = (ids) => ids.length ? ids.map((id) => `<@&${id}>`).join(', ') : 'Not configured';
    const showChannel = (id) => id ? `<#${id}>` : 'Not configured';
    const embed = new EmbedBuilder().setTitle('Development Bot Configuration').addFields(
      { name: 'Developer Command Roles', value: showRoles(config.developerRoleIds) },
      { name: 'QA Reviewer Roles', value: showRoles(config.qaRoleIds) },
      { name: 'LEO Ticket Handlers', value: showRoles(ticketHandlerRoleIds(config, 'leo')) },
      { name: 'Livery Ticket Handlers', value: showRoles(ticketHandlerRoleIds(config, 'livery')) },
      { name: 'Commission Ticket Handlers', value: showRoles(ticketHandlerRoleIds(config, 'commission')) },
      { name: 'QA Ticket Handlers', value: showRoles(ticketHandlerRoleIds(config, 'qa')) },
      { name: 'Transfer Managers', value: showRoles(config.transferRoleIds.length ? config.transferRoleIds : config.developerRoleIds) },
      { name: 'LEO Category', value: showChannel(config.leoCategoryId), inline: true },
      { name: 'Livery Category', value: showChannel(config.liveryCategoryId), inline: true },
      { name: 'Commission Category', value: showChannel(config.commissionCategoryId), inline: true },
      { name: 'QA Ticket Category', value: showChannel(config.qaTicketCategoryId), inline: true },
      { name: 'QA Submission Channel', value: showChannel(config.qaChannelId), inline: true },
      { name: 'Saturday Transfer Channel', value: showChannel(config.transferChannelId), inline: true },
      { name: 'Ticket / Transcript Logs', value: showChannel(config.ticketLogChannelId || config.logChannelId), inline: true },
      { name: 'QA Logs', value: showChannel(config.qaLogChannelId || config.logChannelId), inline: true },
      { name: 'Transfer Logs', value: showChannel(config.transferLogChannelId || config.logChannelId), inline: true },
      { name: 'Configuration Logs', value: showChannel(config.configLogChannelId || config.logChannelId), inline: true },
      { name: 'Role Sync Logs', value: showChannel(config.roleSyncLogChannelId || config.logChannelId), inline: true },
    );
    return interaction.editReply({ embeds: [embed] });
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag} (${client.user.id}).`);
  console.log(`Connected to ${client.guilds.cache.size} guild(s).`);
  console.log(`Data path: ${DATA_PATH}`);
  try { await registerCommands(); } catch (error) { console.error('Global command registration failed:', error); }
  setInterval(() => transferSchedulerTick().catch(console.error), 60000).unref?.();
  transferSchedulerTick().catch(console.error);
});

client.on('guildMemberAdd', (member) => syncMemberOnJoin(member).catch((error) => console.error('Join role sync error:', error)));

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (newMember.user.bot) return;
  for (const roleName of data.syncRoles) {
    if (hasSyncLock(newMember.guild.id, newMember.id, roleName)) continue;
    const before = memberHasRoleName(oldMember, roleName);
    const after = memberHasRoleName(newMember, roleName);
    if (before === after) continue;

    if (after) {
      const result = await propagateRole(newMember.guild.id, newMember.id, roleName, true);
      console.log(`Role sync ADD ${roleName} for ${newMember.user.tag}: changed=${result.changed}, skipped=${result.skipped}, errors=${result.errors}`);
      continue;
    }

    const otherSourceGuild = await findOtherRoleSource(newMember.guild.id, newMember.id, roleName);
    if (otherSourceGuild) {
      const role = manageableRoleByName(newMember.guild, roleName);
      if (role && !newMember.roles.cache.has(role.id)) {
        try {
          setSyncLock(newMember.guild.id, newMember.id, roleName);
          await newMember.roles.add(role, `Cross-server role sync restored from guild ${otherSourceGuild.id}`);
          await sendConfiguredLog(newMember.guild, 'role_sync', {
            embeds: [auditEmbed('Cross-Server Role Sync', newMember.user, [
              { name: 'Action', value: 'Role Restored', inline: true },
              { name: 'Role', value: roleName, inline: true },
              { name: 'Source Guild', value: `${otherSourceGuild.name} (${otherSourceGuild.id})`, inline: false },
            ])],
          });
        } catch (error) {
          console.warn(`Role restore failed for ${newMember.user.tag}, ${roleName}: ${error.message}`);
        }
      }
      continue;
    }

    const result = await propagateRole(newMember.guild.id, newMember.id, roleName, false);
    console.log(`Role sync REMOVE ${roleName} for ${newMember.user.tag}: changed=${result.changed}, skipped=${result.skipped}, errors=${result.errors}`);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'syncrole') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isAdmin(interaction)) return interaction.editReply('Administrator permission is required.');
        const sub = interaction.options.getSubcommand();
        if (sub === 'add') {
          const role = interaction.options.getRole('role', true);
          if (role.id === interaction.guildId || role.managed) return interaction.editReply('That role cannot be synchronized.');
          data.syncRoles = [...new Set([...data.syncRoles, role.name])].sort((a, b) => a.localeCompare(b));
          saveData();
          await sendConfiguredLog(interaction.guild, 'role_sync', {
            embeds: [auditEmbed('Role Sync Configuration Changed', interaction.user, [
              { name: 'Action', value: 'Sync Role Added', inline: true },
              { name: 'Role Name', value: role.name, inline: true },
              { name: 'Source Role', value: `<@&${role.id}> (${role.id})`, inline: false },
            ])],
          });
          await interaction.editReply(`Now syncing the exact role name **${role.name}** across every mutual server. Existing members with this role in this server are being backfilled automatically.`);
          backfillRoleFromSourceGuild(interaction.guild, role.id, role.name)
            .then((result) => console.log(`Initial role backfill for ${role.name}: sourceMembers=${result.scanned}, roleChanges=${result.changed}, errors=${result.errors}`))
            .catch((error) => console.error(`Initial role backfill failed for ${role.name}:`, error));
          return;
        }
        if (sub === 'remove') {
          const name = interaction.options.getString('name', true).trim();
          data.syncRoles = data.syncRoles.filter((roleName) => roleName !== name);
          saveData();
          await sendConfiguredLog(interaction.guild, 'role_sync', {
            embeds: [auditEmbed('Role Sync Configuration Changed', interaction.user, [
              { name: 'Action', value: 'Sync Role Removed', inline: true },
              { name: 'Role Name', value: name, inline: true },
            ])],
          });
          return interaction.editReply(`Stopped syncing **${name}**.`);
        }
        if (sub === 'list') {
          return interaction.editReply(data.syncRoles.length ? data.syncRoles.map((name) => `- ${name}`).join('\n') : 'No exact role names are configured for synchronization.');
        }
        if (sub === 'diagnose') {
          const name = interaction.options.getString('name', true);
          const lines = [];
          for (const guild of client.guilds.cache.values()) {
            const role = exactRoleByName(guild, name);
            if (!role) lines.push(`${guild.name}: role missing`);
            else lines.push(`${guild.name}: role exists - ${role.editable ? 'bot can manage it' : 'bot CANNOT manage it (move the bot role above it / grant Manage Roles)'}`);
          }
          return interaction.editReply(lines.join('\n').slice(0, 1900) || 'No guilds found.');
        }
      }

      if (interaction.commandName === 'syncmember') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isAdmin(interaction)) return interaction.editReply('Administrator permission is required.');
        const user = interaction.options.getUser('user', true);
        const result = await backfillMember(user.id);
        await sendConfiguredLog(interaction.guild, 'role_sync', {
          embeds: [auditEmbed('Manual Member Role Sync', interaction.user, [
            { name: 'Member', value: `<@${user.id}> (${user.id})`, inline: true },
            { name: 'Mutual Servers', value: String(result.mutualGuilds), inline: true },
            { name: 'Roles Added', value: String(result.added), inline: true },
            { name: 'Synced Role Names', value: result.roles.length ? result.roles.join(', ') : 'None', inline: false },
          ])],
        });
        return interaction.editReply(`Checked ${result.mutualGuilds} mutual server(s). Synced roles: ${result.roles.length ? result.roles.join(', ') : 'none'}. Roles added: ${result.added}.`);
      }

      if (interaction.commandName === 'dev-config') return handleDevConfig(interaction);

      if (interaction.commandName === 'dev-panel') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isAdmin(interaction)) return interaction.editReply('Administrator permission is required.');
        const panelMessage = await interaction.channel.send(developmentPanel());
        await sendConfiguredLog(interaction.guild, 'config', {
          embeds: [auditEmbed('Development Ticket Panel Posted', interaction.user, [
            { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
            { name: 'Message', value: `[Open Panel Message](${panelMessage.url})`, inline: true },
          ])],
        });
        return interaction.editReply('Development ticket panel posted.');
      }

      if (interaction.commandName === 'approve-vehicle') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isDeveloper(interaction.member)) return interaction.editReply('Only the configured Developer team can submit vehicles for QA.');
        const key = shortId('vf_');
        pendingVehicle.set(key, {
          guildId: interaction.guildId,
          submitterId: interaction.user.id,
          sourceChannelId: interaction.channelId,
          spawnCode: interaction.options.getString('spawn_code', true),
          vehicleName: interaction.options.getString('vehicle_name'),
          otherFlags: interaction.options.getString('other_flags'),
          notes: interaction.options.getString('notes'),
          createdAt: Date.now(),
        });
        setTimeout(() => pendingVehicle.delete(key), 10 * 60 * 1000).unref?.();
        return interaction.editReply({ content: 'Select every vehicle flag that applies. The submission will then be sent to Quality Assurance.', components: [vehicleFlagMenu(key)] });
      }

      if (interaction.commandName === 'approve-ymap') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isDeveloper(interaction.member)) return interaction.editReply('Only the configured Developer team can submit YMAPs for QA.');
        const submission = {
          id: shortId('qa_'), guildId: interaction.guildId, kind: 'ymap', submitterId: interaction.user.id,
          sourceChannelId: interaction.channelId,
          identifier: interaction.options.getString('resource', true), displayName: interaction.options.getString('map_name'),
          location: interaction.options.getString('location'), notes: interaction.options.getString('notes'), flags: [],
          status: 'Pending QA', createdAt: Date.now(), reviewedBy: null, reviewReason: null,
        };
        try {
          const message = await postQASubmission(interaction.guild, submission);
          return interaction.editReply(`YMAP submitted to Quality Assurance: ${message.url}`);
        } catch (error) { return interaction.editReply(error.message); }
      }

      if (interaction.commandName === 'mark-for-transfer') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isDeveloper(interaction.member) && !isTransferManager(interaction.member))) return interaction.editReply('Developer or Transfer Manager permission is required.');
        const item = {
          id: shortId('tr_'), guildId: interaction.guildId, developerId: interaction.user.id,
          type: interaction.options.getString('type', true), name: interaction.options.getString('name', true),
          identifier: interaction.options.getString('identifier'), notes: interaction.options.getString('notes'),
          status: 'pending', createdAt: Date.now(), completedAt: null, completedBy: null,
        };
        data.transfers.push(item); saveData();
        await sendConfiguredLog(interaction.guild, 'transfer', {
          embeds: [auditEmbed('Item Marked for Transfer', interaction.user, [
            { name: 'Type', value: item.type, inline: true },
            { name: 'Name', value: truncate(item.name), inline: true },
            { name: 'Identifier', value: item.identifier ? `\`${truncate(item.identifier, 200)}\`` : 'N/A', inline: true },
            { name: 'Transfer ID', value: `\`${item.id}\``, inline: true },
            { name: 'Notes', value: truncate(item.notes || 'None'), inline: false },
          ])],
        });
        return interaction.editReply(`Marked **${item.name}** for the Saturday 4:00 PM Eastern transfer. Transfer ID: \`${item.id}\``);
      }

      if (interaction.commandName === 'transfer-list') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isDeveloper(interaction.member) && !isQA(interaction.member) && !isTransferManager(interaction.member))) return interaction.editReply('Developer, Quality Assurance, or Transfer Manager permission is required.');
        const pending = data.transfers.filter((item) => item.guildId === interaction.guildId && item.status === 'pending');
        const lines = pending.map((item) => `\`${item.id}\` - ${item.type} - **${item.name}**${item.identifier ? ` - ${item.identifier}` : ''}`);
        return interaction.editReply(lines.length ? lines.join('\n').slice(0, 1900) : 'No items are currently marked for transfer.');
      }

      if (interaction.commandName === 'transfer-complete') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isTransferManager(interaction.member)) return interaction.editReply('Transfer Manager permission is required.');
        const id = interaction.options.getString('id', true).trim();
        const completed = [];
        for (const item of data.transfers) {
          if (item.guildId !== interaction.guildId || item.status !== 'pending') continue;
          if (id.toUpperCase() !== 'ALL' && item.id !== id) continue;
          item.status = 'completed'; item.completedAt = Date.now(); item.completedBy = interaction.user.id; completed.push(item);
        }
        saveData();
        if (completed.length) {
          await sendConfiguredLog(interaction.guild, 'transfer', {
            embeds: [auditEmbed('Transfer Item(s) Completed', interaction.user, [
              { name: 'Completed', value: completed.map((item) => `\`${item.id}\` - ${item.type} - ${item.name}`).join('\n').slice(0, 1024) },
            ])],
          });
        }
        return interaction.editReply(completed.length ? `Marked ${completed.length} transfer item(s) complete.` : 'No matching pending transfer item was found.');
      }

      if (interaction.commandName === 'transfer-post') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isTransferManager(interaction.member)) return interaction.editReply('Transfer Manager permission is required.');
        const posted = await postTransferWindow(interaction.guild, true);
        if (posted) {
          await sendConfiguredLog(interaction.guild, 'transfer', {
            embeds: [auditEmbed('Transfer List Posted Manually', interaction.user)],
          });
        }
        return interaction.editReply(posted ? 'Transfer list posted.' : 'Configure a transfer channel first with /dev-config.');
      }

      if (['ticket-close', 'ticket-delete', 'ticket-add', 'ticket-remove'].includes(interaction.commandName)) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild()) return interaction.editReply('This command can only be used in a server.');
        const ticket = data.tickets[interaction.channelId];
        if (!ticket) return interaction.editReply('This is not a registered development ticket.');
        if (interaction.commandName === 'ticket-close') return closeTicket(interaction, interaction.channelId);
        if (interaction.commandName === 'ticket-delete') return deleteTicket(interaction, interaction.channelId);
        const handlerIds = ticketHandlerRoleIds(guildConfig(interaction.guildId), ticket.type);
        if (!isAdmin(interaction.member) && !hasAnyRole(interaction.member, handlerIds)) return interaction.editReply('Development/QA team permission is required.');
        const user = interaction.options.getUser('user', true);
        if (interaction.commandName === 'ticket-add') {
          await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true });
          await sendConfiguredLog(interaction.guild, 'ticket', {
            embeds: [auditEmbed('Ticket Member Added', interaction.user, [
              { name: 'Ticket', value: `<#${interaction.channelId}>`, inline: true },
              { name: 'Member', value: `<@${user.id}> (${user.id})`, inline: true },
            ])],
          });
          return interaction.editReply(`Added <@${user.id}> to this ticket.`);
        }
        await interaction.channel.permissionOverwrites.delete(user.id).catch(() => null);
        await sendConfiguredLog(interaction.guild, 'ticket', {
          embeds: [auditEmbed('Ticket Member Removed', interaction.user, [
            { name: 'Ticket', value: `<#${interaction.channelId}>`, inline: true },
            { name: 'Member', value: `<@${user.id}> (${user.id})`, inline: true },
          ])],
        });
        return interaction.editReply(`Removed <@${user.id}> from this ticket.`);
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('open_ticket:')) {
        const type = interaction.customId.split(':')[1];
        const modal = ticketModal(type);
        if (!modal) return interaction.reply({ content: 'Unknown ticket type.', flags: MessageFlags.Ephemeral });
        return interaction.showModal(modal);
      }
      if (interaction.customId.startsWith('ticket_close:')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return closeTicket(interaction, interaction.customId.split(':')[1]);
      }
      if (interaction.customId.startsWith('ticket_delete:')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return deleteTicket(interaction, interaction.customId.split(':')[1]);
      }
      if (interaction.customId.startsWith('qa_review:')) {
        const [, decision, id] = interaction.customId.split(':');
        return reviewQASubmission(interaction, decision, id);
      }
      if (interaction.customId.startsWith('qa_transfer:')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const submissionId = interaction.customId.split(':')[1];
        const submission = data.qaSubmissions[submissionId];
        if (!submission || submission.guildId !== interaction.guildId) return interaction.editReply('QA submission not found.');
        if (submission.status !== 'Approved') return interaction.editReply('Only approved QA submissions can be marked for transfer.');
        if (!isDeveloper(interaction.member) && !isTransferManager(interaction.member)) return interaction.editReply('Developer or Transfer Manager permission is required.');
        if (submission.transferId) return interaction.editReply(`This submission is already marked for transfer as \`${submission.transferId}\`.`);
        const item = await createTransferFromSubmission(interaction.guild, submission, interaction.user);
        if (interaction.message?.editable) {
          await interaction.message.edit({ components: [markTransferButton(submission.id, true)] }).catch(() => null);
        }
        return interaction.editReply(`Marked **${item.name}** for the Saturday 4:00 PM Eastern transfer. Transfer ID: \`${item.id}\``);
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('vehicle_flags:')) {
      await interaction.deferUpdate();
      const key = interaction.customId.split(':')[1];
      const pending = pendingVehicle.get(key);
      if (!pending || pending.guildId !== interaction.guildId || pending.submitterId !== interaction.user.id) {
        return interaction.editReply({ content: 'This vehicle submission expired. Run /approve-vehicle again.', components: [] });
      }
      if (!isDeveloper(interaction.member)) return interaction.editReply({ content: 'Developer permission is required.', components: [] });
      const labels = {
        bulletproof: 'Bulletproof', bulletproof_tires: 'Bulletproof Tires', nitrous: 'Nitrous', armored: 'Armored',
        weaponized: 'Weaponized', custom_handling: 'Custom Handling', emergency_lighting: 'Emergency Lighting / ELS',
        custom_audio: 'Custom Audio', drift: 'Drift Setup', none: 'No Special Flags',
      };
      let flags = interaction.values.filter((value) => value !== 'none').map((value) => labels[value] || value);
      if (pending.otherFlags) flags.push(...pending.otherFlags.split(',').map((x) => x.trim()).filter(Boolean));
      flags = [...new Set(flags)];
      const submission = {
        id: shortId('qa_'), guildId: interaction.guildId, kind: 'vehicle', submitterId: interaction.user.id,
        sourceChannelId: pending.sourceChannelId,
        identifier: pending.spawnCode, displayName: pending.vehicleName, flags, notes: pending.notes,
        status: 'Pending QA', createdAt: pending.createdAt, reviewedBy: null, reviewReason: null,
      };
      pendingVehicle.delete(key);
      try {
        const message = await postQASubmission(interaction.guild, submission);
        return interaction.editReply({ content: `Vehicle submitted to Quality Assurance: ${message.url}`, components: [] });
      } catch (error) {
        return interaction.editReply({ content: error.message, components: [] });
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('ticket_modal:')) {
        return createTicketFromModal(interaction, interaction.customId.split(':')[1]);
      }
      if (interaction.customId.startsWith('qa_review_modal:')) {
        const [, decision, id] = interaction.customId.split(':');
        return finalizeQAReview(interaction, decision, id);
      }
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (interaction.isRepliable()) {
      if (interaction.deferred) await interaction.editReply('An error occurred. Check the bot console.').catch(() => null);
      else if (!interaction.replied) await interaction.reply({ content: 'An error occurred. Check the bot console.', flags: MessageFlags.Ephemeral }).catch(() => null);
    }
  }
});

client.login(TOKEN);
