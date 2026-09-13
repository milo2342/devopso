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
  UserSelectMenuBuilder,
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
  staff: {},
  tasks: {},
  assets: {},
  transferBatches: {},
  agreements: {},
  agreementRequests: {},
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
      staff: parsed.staff && typeof parsed.staff === 'object' ? parsed.staff : {},
      tasks: parsed.tasks && typeof parsed.tasks === 'object' ? parsed.tasks : {},
      assets: parsed.assets && typeof parsed.assets === 'object' ? parsed.assets : {},
      transferBatches: parsed.transferBatches && typeof parsed.transferBatches === 'object' ? parsed.transferBatches : {},
      agreements: parsed.agreements && typeof parsed.agreements === 'object' ? parsed.agreements : {},
      agreementRequests: parsed.agreementRequests && typeof parsed.agreementRequests === 'object' ? parsed.agreementRequests : {},
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
      departmentHandlerRoleIds: [],
      gangHandlerRoleIds: [],
      transferRoleIds: [],
      leoCategoryId: null,
      liveryCategoryId: null,
      commissionCategoryId: null,
      qaTicketCategoryId: null,
      departmentCategoryId: null,
      gangCategoryId: null,
      qaChannelId: null,
      transferChannelId: null,
      ticketLogChannelId: null,
      qaLogChannelId: null,
      transferLogChannelId: null,
      configLogChannelId: null,
      roleSyncLogChannelId: null,
      staffManagerRoleIds: [],
      developerRankRoleIds: [],
      qaRankRoleIds: [],
      developerBaseRoleId: null,
      qaBaseRoleId: null,
      suspendedRoleId: null,
      removedRoleId: null,
      blacklistedRoleId: null,
      staffLogChannelId: null,
      developerMovementChannelId: null,
      qaMovementChannelId: null,
      qaNotificationRoleId: null,
      devLogChannelId: null,
      agreementLogChannelId: null,
      agreementVersion: 'WCRP-DEV-1.0',
      agreementRequiredBeforeHire: true,
      logChannelId: null,
    };
    saveData();
  }
  const config = data.guilds[guildId];
  const defaults = {
    developerRoleIds: [], qaRoleIds: [], leoHandlerRoleIds: [], liveryHandlerRoleIds: [],
    commissionHandlerRoleIds: [], qaTicketHandlerRoleIds: [], departmentHandlerRoleIds: [], gangHandlerRoleIds: [], transferRoleIds: [],
    leoCategoryId: null, liveryCategoryId: null, commissionCategoryId: null, qaTicketCategoryId: null, departmentCategoryId: null, gangCategoryId: null,
    qaChannelId: null, transferChannelId: null, ticketLogChannelId: null, qaLogChannelId: null,
    transferLogChannelId: null, configLogChannelId: null, roleSyncLogChannelId: null, staffManagerRoleIds: [],
    developerRankRoleIds: [], qaRankRoleIds: [], developerBaseRoleId: null, qaBaseRoleId: null, suspendedRoleId: null,
    removedRoleId: null, blacklistedRoleId: null, staffLogChannelId: null, developerMovementChannelId: null, qaMovementChannelId: null, qaNotificationRoleId: null, devLogChannelId: null, agreementLogChannelId: null, agreementVersion: 'WCRP-DEV-1.0', agreementRequiredBeforeHire: true, logChannelId: null,
  };
  let changed = false;
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in config)) { config[key] = Array.isArray(value) ? [] : value; changed = true; }
  }
  const singularTicketHandlerKeys = ['leoHandlerRoleIds', 'liveryHandlerRoleIds', 'commissionHandlerRoleIds', 'qaTicketHandlerRoleIds', 'departmentHandlerRoleIds', 'gangHandlerRoleIds'];
  for (const key of singularTicketHandlerKeys) {
    if (Array.isArray(config[key]) && config[key].length > 1) {
      config[key] = [config[key][config[key].length - 1]];
      changed = true;
    }
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
    department_handler: config.departmentHandlerRoleIds,
    gang_handler: config.gangHandlerRoleIds,
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
    staff: config.staffLogChannelId || config.logChannelId,
    dev: config.devLogChannelId || config.configLogChannelId || config.logChannelId,
    agreement: config.agreementLogChannelId || config.staffLogChannelId || config.logChannelId,
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


function agreementGuild(guildId) {
  if (!data.agreements[guildId] || typeof data.agreements[guildId] !== 'object') data.agreements[guildId] = {};
  return data.agreements[guildId];
}

function agreementProfile(guildId, userId) {
  const store = agreementGuild(guildId);
  if (!store[userId] || typeof store[userId] !== 'object') store[userId] = { current: null, history: [] };
  if (!Array.isArray(store[userId].history)) store[userId].history = [];
  return store[userId];
}

function agreementTeamLabel(team) {
  return ({ developer: 'Development Team', qa: 'Quality Assurance', both: 'Development Team & Quality Assurance' })[team] || 'Development / QA';
}

function currentAgreement(guildId, userId) {
  return agreementProfile(guildId, userId).current || null;
}

function agreementCoversTeam(record, team) {
  if (!record || record.status !== 'signed') return false;
  return !team || record.team === 'both' || record.team === team;
}

function hasCurrentAgreement(guildId, userId, team = null) {
  const config = guildConfig(guildId);
  const record = currentAgreement(guildId, userId);
  return Boolean(record && record.version === config.agreementVersion && agreementCoversTeam(record, team));
}

function agreementTerms(version) {
  return [
    '**WCRP Development & Quality Assurance Access Agreement**',
    '',
    `Agreement version: **${version}**`,
    '',
    'By signing, I acknowledge and agree that:',
    '1. My WCRP development, QA, Discord, repository, server, panel, bot, hosting, database, file, and related access is provided only for authorized WCRP work.',
    '2. I will not intentionally delete, destroy, mass-modify, sabotage, disrupt, leak, backdoor, compromise, or misuse WCRP channels, roles, permissions, code, files, credentials, data, infrastructure, or services. This includes server/Discord “nuking” and unauthorized destructive automation.',
    '3. I will follow WCRP rules, security procedures, access restrictions, and lawful management instructions while I hold privileged access.',
    '4. If I violate WCRP rules or misuse access, WCRP may immediately suspend or revoke my access and remove my roles/permissions while the matter is reviewed.',
    '5. WCRP may preserve audit logs, messages, access records, repository history, screenshots, backups, and other relevant evidence concerning suspected misuse.',
    '6. Serious intentional misconduct may be reported to Discord, hosting/platform providers, or appropriate authorities, and WCRP may pursue remedies that are available under applicable law.',
    '7. I understand that this acknowledgement does not guarantee that any particular legal claim or remedy will apply; enforceability depends on the facts, applicable law, jurisdiction, and other circumstances.',
    '8. Typing my name and the exact phrase **I AGREE** records my affirmative acknowledgement under my Discord account and timestamp.',
  ].join('\n');
}

function agreementEmbed(guild, request) {
  return new EmbedBuilder()
    .setTitle('WCRP Privileged Access Agreement')
    .setDescription(agreementTerms(request.version))
    .addFields(
      { name: 'Applies To', value: agreementTeamLabel(request.team), inline: true },
      { name: 'Requested By', value: `<@${request.sentBy}>`, inline: true },
      { name: 'Server', value: guild?.name || request.guildId, inline: true },
      { name: 'Required Signature', value: 'Press **Review & Sign**, type your name, then type exactly **I AGREE**.', inline: false },
    )
    .setFooter({ text: 'Your Discord user ID, typed name, agreement version, and timestamp are recorded when you sign.' })
    .setTimestamp(new Date(request.sentAt));
}

function agreementButtons(requestId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`agreement_sign:${requestId}`).setLabel('Review & Sign').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`agreement_decline:${requestId}`).setLabel('Decline').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

function agreementSignModal(requestId) {
  return new ModalBuilder()
    .setCustomId(`agreement_sign_modal:${requestId}`)
    .setTitle('Sign WCRP Access Agreement')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('typed_name')
          .setLabel('Type your full name')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Your name')
          .setMinLength(2)
          .setMaxLength(100)
          .setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('affirmation')
          .setLabel('Type exactly: I AGREE')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('I AGREE')
          .setMinLength(7)
          .setMaxLength(20)
          .setRequired(true),
      ),
    );
}

function agreementStatusEmbed(guild, user, profile) {
  const config = guildConfig(guild.id);
  const current = profile?.current || null;
  const isCurrent = Boolean(current && current.status === 'signed' && current.version === config.agreementVersion);
  const embed = new EmbedBuilder()
    .setTitle(`Access Agreement - ${user.username}`)
    .setDescription(`<@${user.id}> (${user.id})`)
    .addFields(
      { name: 'Current Required Version', value: config.agreementVersion, inline: true },
      { name: 'Requirement', value: config.agreementRequiredBeforeHire ? 'Required before hiring' : 'Not enforced before hiring', inline: true },
      { name: 'Valid Current Signature', value: isCurrent ? 'Yes' : 'No', inline: true },
    )
    .setTimestamp();
  if (current) {
    embed.addFields(
      { name: 'Status', value: current.status || 'unknown', inline: true },
      { name: 'Signed Version', value: current.version || 'Unknown', inline: true },
      { name: 'Applies To', value: agreementTeamLabel(current.team), inline: true },
      { name: 'Typed Name', value: truncate(current.typedName || 'Not recorded', 200), inline: true },
      { name: 'Recorded At', value: current.signedAt ? `<t:${Math.floor(current.signedAt / 1000)}:F>` : (current.at ? `<t:${Math.floor(current.at / 1000)}:F>` : 'Not signed'), inline: true },
    );
    if (current.revocationReason) embed.addFields({ name: 'Revocation Reason', value: truncate(current.revocationReason), inline: false });
  }
  embed.setFooter({ text: `${profile?.history?.length || 0} agreement event(s) recorded` });
  return embed;
}

async function logAgreementEvent(guild, title, actor, userId, fields = []) {
  return sendConfiguredLog(guild, 'agreement', {
    embeds: [auditEmbed(title, actor, [
      { name: 'Member', value: `<@${userId}> (${userId})`, inline: false },
      ...fields,
    ])],
  });
}

async function sendAgreementRequest({ guild, actor, target, team }) {
  const config = guildConfig(guild.id);
  const existing = currentAgreement(guild.id, target.id);
  if (existing?.status === 'signed' && existing.version === config.agreementVersion && agreementCoversTeam(existing, team)) {
    throw new Error(`That member has already signed the current agreement version (${config.agreementVersion}) for ${agreementTeamLabel(team)}.`);
  }
  for (const request of Object.values(data.agreementRequests)) {
    if (request?.guildId === guild.id && request?.userId === target.id && request.status === 'pending') request.status = 'superseded';
  }
  const request = {
    id: shortId('agr_'),
    guildId: guild.id,
    userId: target.id,
    team,
    version: config.agreementVersion,
    sentBy: actor.id,
    sentAt: Date.now(),
    status: 'pending',
  };
  data.agreementRequests[request.id] = request;
  saveData();
  try {
    const message = await target.send({ embeds: [agreementEmbed(guild, request)], components: [agreementButtons(request.id)] });
    request.dmChannelId = message.channelId;
    request.dmMessageId = message.id;
    saveData();
  } catch (error) {
    request.status = 'delivery_failed';
    request.deliveryError = error.message;
    saveData();
    throw new Error('I could not DM that user. They may have DMs disabled or may not share a server with the bot.');
  }
  await logAgreementEvent(guild, 'Privileged Access Agreement Sent', actor, target.id, [
    { name: 'Version', value: request.version, inline: true },
    { name: 'Applies To', value: agreementTeamLabel(team), inline: true },
    { name: 'Request ID', value: `\`${request.id}\``, inline: true },
  ]);
  return request;
}

async function finishAgreementSignature(interaction, request) {
  const typedName = interaction.fields.getTextInputValue('typed_name').trim();
  const affirmation = interaction.fields.getTextInputValue('affirmation').trim();
  if (typedName.length < 2) return interaction.reply({ content: 'Signature not accepted. Enter the name you are signing under.' });
  if (affirmation !== 'I AGREE') return interaction.reply({ content: 'Signature not accepted. The confirmation must be typed exactly as **I AGREE**. Press Review & Sign and try again.' });
  if (request.status !== 'pending') return interaction.reply({ content: `This agreement request is no longer pending (status: ${request.status}).` });
  if (interaction.user.id !== request.userId) return interaction.reply({ content: 'Only the person this agreement was sent to can sign it.' });

  const profile = agreementProfile(request.guildId, request.userId);
  const previousCurrent = profile.current;
  const combinedTeam = previousCurrent?.status === 'signed' && previousCurrent.version === request.version && previousCurrent.team !== request.team ? 'both' : request.team;
  const record = {
    status: 'signed',
    version: request.version,
    team: combinedTeam,
    typedName,
    affirmation: 'I AGREE',
    discordUserId: interaction.user.id,
    discordUsername: interaction.user.username,
    discordGlobalName: interaction.user.globalName || null,
    requestId: request.id,
    sentBy: request.sentBy,
    sentAt: request.sentAt,
    signedAt: Date.now(),
  };
  profile.current = record;
  profile.history.unshift({ ...record, at: record.signedAt, event: 'signed' });
  profile.history = profile.history.slice(0, 100);
  request.status = 'signed';
  request.signedAt = record.signedAt;
  saveData();

  const guild = client.guilds.cache.get(request.guildId);
  if (guild) {
    await logAgreementEvent(guild, 'Privileged Access Agreement Signed', interaction.user, request.userId, [
      { name: 'Typed Name', value: truncate(typedName, 200), inline: true },
      { name: 'Affirmation', value: '`I AGREE`', inline: true },
      { name: 'Version', value: request.version, inline: true },
      { name: 'Applies To', value: agreementTeamLabel(request.team), inline: true },
      { name: 'Signed At', value: `<t:${Math.floor(record.signedAt / 1000)}:F>`, inline: true },
      { name: 'Discord Account', value: `${interaction.user.username} (${interaction.user.id})`, inline: false },
    ]);
  }
  const manager = await client.users.fetch(request.sentBy).catch(() => null);
  if (manager) {
    await manager.send({ embeds: [new EmbedBuilder()
      .setTitle('Access Agreement Signed')
      .setDescription(`<@${request.userId}> signed **${request.version}** for **${agreementTeamLabel(request.team)}**.`)
      .addFields({ name: 'Typed Name', value: truncate(typedName, 200), inline: true }, { name: 'Signed', value: `<t:${Math.floor(record.signedAt / 1000)}:F>`, inline: true })
      .setTimestamp()] }).catch(() => null);
  }
  return interaction.reply({ embeds: [new EmbedBuilder()
    .setTitle('Agreement Signed')
    .setDescription('Your signature has been recorded successfully. Keep this message as your receipt.')
    .addFields(
      { name: 'Typed Name', value: truncate(typedName, 200), inline: true },
      { name: 'Agreement Version', value: request.version, inline: true },
      { name: 'Confirmation', value: '`I AGREE`', inline: true },
      { name: 'Signed At', value: `<t:${Math.floor(record.signedAt / 1000)}:F>`, inline: false },
      { name: 'Discord Account', value: `${interaction.user.username} (${interaction.user.id})`, inline: false },
    )
    .setFooter({ text: 'This receipt records your acknowledgement; legal enforceability depends on applicable law and circumstances.' })
    .setTimestamp()] });
}

async function declineAgreement(interaction, request) {
  if (interaction.user.id !== request.userId) return interaction.reply({ content: 'Only the person this agreement was sent to can decline it.' });
  if (request.status !== 'pending') return interaction.reply({ content: `This agreement request is no longer pending (status: ${request.status}).` });
  request.status = 'declined';
  request.declinedAt = Date.now();
  const profile = agreementProfile(request.guildId, request.userId);
  const record = { status: 'declined', version: request.version, team: request.team, requestId: request.id, sentBy: request.sentBy, at: request.declinedAt };
  if (!(profile.current?.status === 'signed' && profile.current.version === request.version)) profile.current = record;
  profile.history.unshift({ ...record, event: 'declined' });
  profile.history = profile.history.slice(0, 100);
  saveData();
  const guild = client.guilds.cache.get(request.guildId);
  if (guild) await logAgreementEvent(guild, 'Privileged Access Agreement Declined', interaction.user, request.userId, [
    { name: 'Version', value: request.version, inline: true },
    { name: 'Applies To', value: agreementTeamLabel(request.team), inline: true },
  ]);
  const manager = await client.users.fetch(request.sentBy).catch(() => null);
  if (manager) await manager.send(`<@${request.userId}> declined the WCRP privileged access agreement **${request.version}**.`).catch(() => null);
  return interaction.reply({ content: 'You declined the agreement. You will remain ineligible for privileged Development/QA access while the current agreement is required.' });
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


function isStaffManager(member) {
  if (!member?.guild) return false;
  if (isAdmin(member)) return true;
  return hasAnyRole(member, guildConfig(member.guild.id).staffManagerRoleIds);
}

function staffGuild(guildId) {
  if (!data.staff[guildId]) data.staff[guildId] = {};
  return data.staff[guildId];
}

function staffRecord(guildId, userId) {
  const guild = staffGuild(guildId);
  if (!guild[userId]) {
    guild[userId] = {
      developer: { status: 'none', rankRoleId: null, previousRankRoleId: null, hiredAt: null, hiredBy: null, updatedAt: null },
      qa: { status: 'none', rankRoleId: null, previousRankRoleId: null, hiredAt: null, hiredBy: null, updatedAt: null },
      notes: [],
      history: [],
    };
  }
  for (const team of ['developer', 'qa']) {
    if (!guild[userId][team]) guild[userId][team] = { status: 'none', rankRoleId: null, previousRankRoleId: null, hiredAt: null, hiredBy: null, updatedAt: null };
  }
  if (!Array.isArray(guild[userId].notes)) guild[userId].notes = [];
  if (!Array.isArray(guild[userId].history)) guild[userId].history = [];
  return guild[userId];
}

function teamLabel(team) { return team === 'qa' ? 'Quality Assurance' : 'Development Team'; }
function teamRanks(config, team) { return team === 'qa' ? config.qaRankRoleIds : config.developerRankRoleIds; }
function teamBaseRoleId(config, team) { return team === 'qa' ? config.qaBaseRoleId : config.developerBaseRoleId; }

function roleManageError(role) {
  if (!role) return 'The configured role no longer exists.';
  if (role.managed) return `The role **${role.name}** is managed by an integration and cannot be assigned manually.`;
  if (!role.editable) return `I cannot manage **${role.name}**. Move my bot role above it and make sure I have Manage Roles.`;
  return null;
}

async function addRoleIfPossible(member, roleId) {
  if (!roleId) return;
  const role = member.guild.roles.cache.get(roleId) || await member.guild.roles.fetch(roleId).catch(() => null);
  const error = roleManageError(role);
  if (error) throw new Error(error);
  if (!member.roles.cache.has(role.id)) await member.roles.add(role, 'WCRP Development Utilities staff management');
}

async function removeRoleIfPossible(member, roleId) {
  if (!roleId || !member.roles.cache.has(roleId)) return;
  const role = member.guild.roles.cache.get(roleId) || await member.guild.roles.fetch(roleId).catch(() => null);
  const error = roleManageError(role);
  if (error) throw new Error(error);
  await member.roles.remove(role, 'WCRP Development Utilities staff management');
}

async function clearConfiguredTeamRoles(member, config, team) {
  const ids = [...new Set([teamBaseRoleId(config, team), ...teamRanks(config, team)].filter(Boolean))];
  for (const id of ids) await removeRoleIfPossible(member, id);
}

async function setTeamRank(member, config, team, rankRoleId) {
  const allowed = teamRanks(config, team);
  if (!allowed.includes(rankRoleId)) throw new Error(`That role is not configured as a ${teamLabel(team)} rank.`);
  await clearConfiguredTeamRoles(member, config, team);
  await addRoleIfPossible(member, teamBaseRoleId(config, team));
  await addRoleIfPossible(member, rankRoleId);
}

function pushStaffHistory(record, action, team, actor, reason, extra = {}) {
  record.history.unshift({ action, team, actorId: actor.id, reason: reason || 'No reason provided', at: Date.now(), ...extra });
  record.history = record.history.slice(0, 100);
}

function staffActionVerb(action, fallback = 'Updated') {
  return {
    hire: 'Onboarded',
    promote: 'Promoted',
    demote: 'Demoted',
    suspend: 'Suspended',
    unsuspend: 'Unsuspended',
    remove: 'Removed',
    blacklist: 'Blacklisted',
    unblacklist: 'Blacklist Removed',
  }[action] || fallback;
}

function staffLogTime() {
  return DateTime.now().setZone(TIMEZONE).toFormat('MM/dd/yyyy HH:mm');
}

function staffMovementChannelId(config, team) {
  return team === 'qa' ? config.qaMovementChannelId : config.developerMovementChannelId;
}

async function postStaffMovementAnnouncement({ guild, actor, targetId, team, action, reason, rankRoleId = null }) {
  const config = guildConfig(guild.id);
  const channelId = staffMovementChannelId(config, team);
  if (!channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return null;
  const rankPart = rankRoleId ? ` | <@&${rankRoleId}>` : '';
  const content = `<@${targetId}> --> ${teamLabel(team)}${rankPart} | ${staffActionVerb(action)} | ${staffLogTime()} | Approved By: <@${actor.id}>\nReason: ${truncate(reason || 'No reason provided', 800)}`;
  return channel.send({
    content,
    allowedMentions: { users: [targetId, actor.id], roles: [] },
  }).catch((error) => {
    console.warn(`${teamLabel(team)} movement post failed in ${guild.name}: ${error.message}`);
    return null;
  });
}

async function notifyStaffMember({ guild, member, actor, team, action, reason, teamRecord }) {
  const rank = teamRecord?.rankRoleId ? (guild.roles.cache.get(teamRecord.rankRoleId) || await guild.roles.fetch(teamRecord.rankRoleId).catch(() => null)) : null;
  const embed = new EmbedBuilder()
    .setTitle(`${teamLabel(team)} Staff Update`)
    .setDescription(`Your ${teamLabel(team)} status in **${guild.name}** has been updated.`)
    .addFields(
      { name: 'Action', value: staffActionVerb(action), inline: true },
      { name: 'Status', value: teamRecord?.status || 'unknown', inline: true },
      { name: 'Rank', value: rank?.name || (teamRecord?.rankRoleId ? 'Configured role' : 'None'), inline: true },
      { name: 'Reason', value: truncate(reason || 'No reason provided'), inline: false },
      { name: 'Approved By', value: actor.tag || actor.username || actor.id, inline: true },
    )
    .setTimestamp();
  try {
    await member.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.warn(`Could not DM staff update to ${member.user.tag}: ${error.message}`);
    return false;
  }
}

async function logStaffAction(guild, title, actor, targetId, team, reason, extraFields = [], meta = {}) {
  const rankPart = meta.rankRoleId ? ` | <@&${meta.rankRoleId}>` : '';
  const actionText = staffActionVerb(meta.action, title);
  const teamText = team ? teamLabel(team) : 'Staff Management';
  const compactLine = `<@${targetId}> --> ${teamText}${rankPart} | ${actionText} | ${staffLogTime()} | Approved By: <@${actor.id}>`;
  const dmText = typeof meta.dmDelivered === 'boolean' ? (meta.dmDelivered ? 'Delivered' : 'Failed / DMs disabled') : 'Not attempted';
  return sendConfiguredLog(guild, 'staff', {
    content: `${compactLine}
Reason: ${truncate(reason || 'No reason provided', 800)} | DM: ${dmText}`,
    allowedMentions: { users: [targetId, actor.id], roles: [] },
  });
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
    department: {
      title: 'Department Development Request',
      fields: [
        ['department_name', 'Department Name', TextInputStyle.Short, 'What department is this request for?', true],
        ['package', 'Purchased Package / Request', TextInputStyle.Paragraph, 'Describe what was purchased, approved, or requested.', true],
        ['assets', 'Requested Assets', TextInputStyle.Paragraph, 'Vehicles, EUP, liveries, YMAPs, scripts, branding, etc.', true],
        ['branding', 'Branding / Style Requirements', TextInputStyle.Paragraph, 'Colors, logos, agency style, naming, and branding requirements.', false],
        ['references', 'References / Notes', TextInputStyle.Paragraph, 'Links, images, documents, or any other notes.', false],
      ],
    },
    gang: {
      title: 'Gang Development Request',
      fields: [
        ['gang_name', 'Gang Name', TextInputStyle.Short, 'What gang / organization is this request for?', true],
        ['package', 'Purchased Package / Request', TextInputStyle.Paragraph, 'Describe what was purchased, approved, or requested.', true],
        ['assets', 'Requested Assets', TextInputStyle.Paragraph, 'Vehicles, EUP, liveries, YMAPs, scripts, branding, etc.', true],
        ['branding', 'Colors / Branding / Theme', TextInputStyle.Paragraph, 'Colors, logos, theme, naming, and branding requirements.', false],
        ['references', 'References / Notes', TextInputStyle.Paragraph, 'Links, images, documents, or any other notes.', false],
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
    department: 'Department Development Request',
    gang: 'Gang Development Request',
  }[type] || 'Development Ticket';
}

function ticketCategoryId(config, type) {
  return {
    leo: config.leoCategoryId,
    livery: config.liveryCategoryId,
    commission: config.commissionCategoryId,
    qa: config.qaTicketCategoryId,
    department: config.departmentCategoryId,
    gang: config.gangCategoryId,
  }[type] || null;
}

function ticketHandlerRoleIds(config, type) {
  const configured = {
    leo: config.leoHandlerRoleIds,
    livery: config.liveryHandlerRoleIds,
    commission: config.commissionHandlerRoleIds,
    qa: config.qaTicketHandlerRoleIds,
    department: config.departmentHandlerRoleIds,
    gang: config.gangHandlerRoleIds,
  }[type] || [];
  if (!configured.length) return [];
  // Ticket routing is intentionally singular: only the explicitly selected handler role is granted access/pinged.
  return [configured[configured.length - 1]];
}

function ticketStatusLabel(status) {
  return ({
    open: 'Open',
    in_progress: 'In Progress',
    waiting_requester: 'Waiting on Requester',
    waiting_dev: 'Waiting on Development',
    ready_for_qa: 'Ready for QA',
    completed: 'Completed / In Game',
    closed: 'Closed',
  })[status] || status || 'Open';
}

function ticketControlRow(channelId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket_status:${channelId}`).setLabel('Update Status').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`ticket_close:${channelId}`).setLabel('Close Ticket').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
}

function ticketStatusMenu(channelId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ticket_status_select:${channelId}`)
      .setPlaceholder('Select the new ticket status...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Open').setValue('open'),
        new StringSelectMenuOptionBuilder().setLabel('In Progress').setValue('in_progress'),
        new StringSelectMenuOptionBuilder().setLabel('Waiting on Requester').setValue('waiting_requester'),
        new StringSelectMenuOptionBuilder().setLabel('Waiting on Development').setValue('waiting_dev'),
        new StringSelectMenuOptionBuilder().setLabel('Ready for QA').setValue('ready_for_qa'),
        new StringSelectMenuOptionBuilder().setLabel('Completed / In Game').setValue('completed'),
      ),
  );
}

async function refreshTicketPanel(channel, ticket) {
  if (!channel?.isTextBased() || !ticket?.messageId) return;
  const message = await channel.messages.fetch(ticket.messageId).catch(() => null);
  if (!message?.embeds?.length) return;
  const original = message.embeds[0].toJSON();
  const fields = (original.fields || []).filter((field) => field.name !== 'Status');
  fields.unshift({ name: 'Status', value: ticketStatusLabel(ticket.status), inline: true });
  const embed = EmbedBuilder.from(original).setFields(fields);
  const closed = ticket.status === 'closed';
  await message.edit({ embeds: [embed], components: closed ? [] : [ticketControlRow(channel.id)] }).catch(() => null);
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
    department_name: 'Department Name',
    gang_name: 'Gang Name',
    package: 'Purchased Package / Request',
    assets: 'Requested Assets',
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
    .addFields({ name: 'Status', value: 'Open', inline: true }, ...fields)
    .setTimestamp();

  const controls = ticketControlRow(channel.id);

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
      { name: 'Handler Role', value: handlerRoleIds.length ? `<@&${handlerRoleIds[0]}>` : 'Not configured' },
    ])],
  });

  await interaction.editReply(`Ticket created: <#${channel.id}>`);
}

async function makeTranscript(channel) {
  const fetchMessages = async (textChannel, maxPages = 20) => {
    const messages = [];
    let before;
    for (let page = 0; page < maxPages; page += 1) {
      const batch = await textChannel.messages.fetch({ limit: 100, before }).catch(() => null);
      if (!batch?.size) break;
      messages.push(...batch.values());
      before = batch.last().id;
      if (batch.size < 100) break;
    }
    return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  };

  const renderMessage = (message, prefix = '') => {
    const lines = [];
    lines.push(`${prefix}[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag} (${message.author.id})`);
    if (message.content) lines.push(`${prefix}${message.content}`);
    for (const embed of message.embeds) {
      if (embed.title) lines.push(`${prefix}EMBED TITLE: ${embed.title}`);
      if (embed.description) lines.push(`${prefix}EMBED DESCRIPTION: ${embed.description}`);
      for (const field of embed.fields || []) lines.push(`${prefix}${field.name}: ${field.value}`);
    }
    const components = [];
    for (const row of message.components || []) {
      for (const component of row.components || []) {
        const label = component.label || component.placeholder || component.customId;
        if (label) components.push(label);
      }
    }
    if (components.length) lines.push(`${prefix}COMPONENTS: ${components.join(', ')}`);
    if (message.attachments.size) lines.push(`${prefix}Attachments: ${[...message.attachments.values()].map((a) => a.url).join(', ')}`);
    lines.push('');
    return lines;
  };

  const messages = await fetchMessages(channel);
  const lines = [];
  for (const message of messages) {
    lines.push(...renderMessage(message));
    let thread = message.thread;
    if (!thread && message.hasThread && channel.threads) thread = await channel.threads.fetch(message.id).catch(() => null);
    if (thread) {
      const threadMessages = await fetchMessages(thread, 10).catch(() => []);
      lines.push(`--- THREAD: ${thread.name} (${thread.id}) ---`);
      for (const threadMessage of threadMessages) lines.push(...renderMessage(threadMessage, '  '));
      lines.push(`--- END THREAD: ${thread.name} ---`, '');
    }
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
  ticket.statusUpdatedAt = Date.now();
  ticket.statusUpdatedBy = interaction.user.id;
  saveData();
  await refreshTicketPanel(channel, ticket);

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

function assetKindLabel(kind) {
  return ({
    vehicle: 'Vehicle',
    ymap: 'YMAP',
    eup: 'EUP',
    livery: 'Livery',
    script: 'Script',
    department: 'Department',
    gang: 'Gang',
    other: 'Development Item',
  })[normalizeAssetKind(kind)] || 'Development Item';
}

function assetIdentifierLabel(kind) {
  return ({
    vehicle: 'Spawn Code',
    ymap: 'Resource / Map',
    eup: 'EUP Resource / Pack',
    livery: 'Livery / File',
    script: 'Resource / Script',
    department: 'Department Identifier',
    gang: 'Gang Identifier',
    other: 'Identifier',
  })[normalizeAssetKind(kind)] || 'Identifier';
}

function qaStatusEmbed(submission) {
  const embed = new EmbedBuilder()
    .setTitle(`${assetKindLabel(submission.kind)} Quality Assurance Submission`)
    .setDescription(`Submitted by <@${submission.submitterId}>`)
    .addFields(
      { name: 'Status', value: submission.status, inline: true },
      { name: assetIdentifierLabel(submission.kind), value: submission.identifier, inline: true },
    )
    .setTimestamp(new Date(submission.createdAt));

  if (submission.displayName) embed.addFields({ name: 'Name', value: truncate(submission.displayName), inline: true });
  if (submission.kind === 'vehicle') embed.addFields({ name: 'Flags', value: submission.flags.length ? submission.flags.join(', ') : 'None', inline: false });
  if (submission.location) embed.addFields({ name: 'Location', value: truncate(submission.location), inline: false });
  if (submission.notes) embed.addFields({ name: 'Developer Notes', value: truncate(submission.notes), inline: false });
  if (submission.claimedBy) embed.addFields({ name: 'QA Claimed By', value: `<@${submission.claimedBy}>`, inline: true });
  if (submission.retestCount) embed.addFields({ name: 'Retest Count', value: String(submission.retestCount), inline: true });
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
    new ButtonBuilder().setCustomId(`qa_review:changes:${submissionId}`).setLabel('Request Changes').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`qa_review:deny:${submissionId}`).setLabel('Denied').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

function qaResultEmbed(submission) {
  const approved = submission.status === 'Approved';
  const changes = submission.status === 'Changes Requested';
  const kindLabel = assetKindLabel(submission.kind);
  const resultLabel = approved ? 'Approved' : (changes ? 'Changes Requested' : 'Denied');
  const description = approved
    ? `Quality Assurance approved this ${kindLabel.toLowerCase()} submission. It can now be marked for the next development transfer.`
    : changes
      ? `Quality Assurance requested changes to this ${kindLabel.toLowerCase()} submission. Make the requested fixes, then use /qa-retest with the submission ID.`
      : `Quality Assurance denied this ${kindLabel.toLowerCase()} submission. Review the reason below before resubmitting.`;
  const embed = new EmbedBuilder()
    .setTitle(`${kindLabel} ${resultLabel}`)
    .setDescription(description)
    .addFields(
      { name: assetIdentifierLabel(submission.kind), value: `\`${truncate(submission.identifier, 200)}\``, inline: true },
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
  const qaNotificationRoleId = config.qaNotificationRoleId && guild.roles.cache.has(config.qaNotificationRoleId) ? config.qaNotificationRoleId : null;
  const qaPing = qaNotificationRoleId ? `<@&${qaNotificationRoleId}>` : null;
  const message = await channel.send({
    content: qaPing || undefined,
    embeds: [qaStatusEmbed(submission)],
    components: [qaReviewButtons(submission.id)],
    allowedMentions: { roles: qaNotificationRoleId ? [qaNotificationRoleId] : [] },
  });
  submission.channelId = channel.id;
  submission.messageId = message.id;
  data.qaSubmissions[submission.id] = submission;
  saveData();

  await sendConfiguredLog(guild, 'qa', {
    embeds: [auditEmbed('QA Submission Created', { id: submission.submitterId }, [
      { name: 'Type', value: assetKindLabel(submission.kind), inline: true },
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

async function submitGenericQASubmission(interaction, { kind, identifier, displayName = null, location = null, notes = null, flags = [], requesterId = null }) {
  const normalizedKind = normalizeAssetKind(kind);
  const cleanIdentifier = String(identifier || displayName || '').trim();
  if (!cleanIdentifier) throw new Error('An asset identifier or name is required.');

  const existingPending = Object.values(data.qaSubmissions).find((x) =>
    x.guildId === interaction.guildId &&
    normalizeAssetKind(x.kind) === normalizedKind &&
    String(x.identifier || '').trim().toLowerCase() === cleanIdentifier.toLowerCase() &&
    x.status === 'Pending QA'
  );
  if (existingPending) throw new Error(`A QA submission for **${cleanIdentifier}** is already pending as \`${existingPending.id}\`.`);

  const existingAsset = findAssets(interaction.guildId, cleanIdentifier, normalizedKind)[0];
  if (existingAsset?.qaStatus === 'Approved') {
    throw new Error(`${assetKindLabel(normalizedKind)} **${cleanIdentifier}** is already approved in the asset registry. Use /asset-info before submitting a replacement.`);
  }

  const sourceTicket = data.tickets[interaction.channelId];
  const submission = {
    id: shortId('qa_'),
    guildId: interaction.guildId,
    kind: normalizedKind,
    submitterId: interaction.user.id,
    requesterId: requesterId || sourceTicket?.openerId || interaction.user.id,
    sourceChannelId: interaction.channelId,
    sourceTicketChannelId: sourceTicket?.channelId || null,
    identifier: cleanIdentifier,
    displayName: displayName || cleanIdentifier,
    location,
    notes,
    flags: Array.isArray(flags) ? flags : [],
    status: 'Pending QA',
    createdAt: Date.now(),
    reviewedBy: null,
    reviewReason: null,
  };
  const message = await postQASubmission(interaction.guild, submission);
  return { submission, message };
}

function startVehicleQASubmission(interaction, spawnCode, vehicleName, otherFlags, notes) {
  const existingAsset = findAssets(interaction.guildId, spawnCode, 'vehicle')[0];
  const existingPending = Object.values(data.qaSubmissions).find((x) => x.guildId === interaction.guildId && x.kind === 'vehicle' && String(x.identifier).toLowerCase() === spawnCode.toLowerCase() && x.status === 'Pending QA');
  if (existingPending) return { error: `A QA submission for spawn code **${spawnCode}** is already pending as \`${existingPending.id}\`.` };
  if (existingAsset?.qaStatus === 'Approved') return { error: `Spawn code **${spawnCode}** is already approved in the asset registry. Use /asset-info before submitting a replacement.` };

  const key = shortId('vf_');
  const sourceTicket = data.tickets[interaction.channelId];
  pendingVehicle.set(key, {
    guildId: interaction.guildId,
    submitterId: interaction.user.id,
    requesterId: sourceTicket?.openerId || interaction.user.id,
    sourceChannelId: interaction.channelId,
    sourceTicketChannelId: sourceTicket?.channelId || null,
    spawnCode,
    vehicleName,
    otherFlags,
    notes,
    createdAt: Date.now(),
  });
  setTimeout(() => pendingVehicle.delete(key), 10 * 60 * 1000).unref?.();
  return { key };
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
  if (submission.claimedBy && submission.claimedBy !== interaction.user.id && !isAdmin(interaction.member)) {
    return interaction.reply({ content: `This QA submission is currently claimed by <@${submission.claimedBy}>.`, flags: MessageFlags.Ephemeral });
  }
  if (!submission.claimedBy) { submission.claimedBy = interaction.user.id; submission.claimedAt = Date.now(); saveData(); }

  const modal = new ModalBuilder()
    .setCustomId(`qa_review_modal:${decision}:${submissionId}`)
    .setTitle(decision === 'approve' ? 'Approve QA Submission' : decision === 'changes' ? 'Request QA Changes' : 'Deny QA Submission')
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

async function notifyQAOutcomeMembers(guild, submission, resultMessage = null) {
  const recipients = [...new Set([submission.submitterId, submission.requesterId].filter(Boolean))];
  let delivered = 0;
  for (const userId of recipients) {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user || user.bot) continue;
    const embed = new EmbedBuilder()
      .setTitle(`Quality Assurance: ${submission.status}`)
      .setDescription(`Your ${assetKindLabel(submission.kind)} submission in **${guild.name}** has been reviewed.`)
      .addFields(
        { name: assetIdentifierLabel(submission.kind), value: `\`${truncate(submission.identifier, 200)}\``, inline: true },
        { name: 'Status', value: submission.status, inline: true },
        { name: 'QA Reason', value: truncate(submission.reviewReason || 'No reason provided.'), inline: false },
        { name: 'Reviewed By', value: submission.reviewedBy ? `<@${submission.reviewedBy}>` : 'Quality Assurance', inline: true },
      )
      .setTimestamp(new Date(submission.reviewedAt || Date.now()));
    if (resultMessage?.url) embed.addFields({ name: 'Result', value: `[Open Result](${resultMessage.url})`, inline: false });
    try {
      await user.send({ embeds: [embed] });
      delivered += 1;
    } catch (error) {
      console.warn(`Could not DM QA result to ${user.tag || userId}: ${error.message}`);
    }
  }
  return { delivered, attempted: recipients.length };
}

async function finalizeQAReview(interaction, decision, submissionId) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const submission = data.qaSubmissions[submissionId];
  if (!submission || submission.guildId !== interaction.guildId) return interaction.editReply('QA submission not found.');
  if (!isQA(interaction.member)) return interaction.editReply('Only the configured Quality Assurance team can review this submission.');
  if (submission.status !== 'Pending QA') return interaction.editReply(`This submission is already ${submission.status}.`);
  if (submission.claimedBy && submission.claimedBy !== interaction.user.id && !isAdmin(interaction.member)) return interaction.editReply(`This QA submission is currently claimed by <@${submission.claimedBy}>.`);

  submission.status = decision === 'approve' ? 'Approved' : (decision === 'changes' ? 'Changes Requested' : 'Denied');
  submission.reviewedBy = interaction.user.id;
  submission.reviewReason = interaction.fields.getTextInputValue('reason');
  submission.reviewedAt = Date.now();
  submission.claimedBy = interaction.user.id;
  submission.claimedAt = submission.claimedAt || Date.now();
  upsertAssetFromSubmission(submission);
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

  const qaDm = await notifyQAOutcomeMembers(interaction.guild, submission, resultMessage);

  await sendConfiguredLog(interaction.guild, 'qa', {
    embeds: [auditEmbed(`QA Submission ${submission.status}`, interaction.user, [
      { name: 'Type', value: assetKindLabel(submission.kind), inline: true },
      { name: 'Identifier', value: `\`${truncate(submission.identifier, 200)}\``, inline: true },
      { name: 'Submitted By', value: `<@${submission.submitterId}>`, inline: true },
      { name: 'Reason', value: truncate(submission.reviewReason), inline: false },
      { name: 'Proof Thread', value: submission.threadId ? `<#${submission.threadId}>` : 'Thread could not be created', inline: true },
      { name: 'Origin Result', value: resultMessage ? `[Open Result](${resultMessage.url})` : 'Origin channel unavailable', inline: true },
      { name: 'DM Notifications', value: `${qaDm.delivered}/${qaDm.attempted} delivered`, inline: true },
    ])],
  });

  await interaction.editReply(`QA submission updated to ${submission.status}. The original command channel was notified, requester/submission DMs were attempted, and a proof thread was created when possible.`);
}

async function createTransferFromSubmission(guild, submission, actor) {
  if (submission.transferId) {
    return data.transfers.find((item) => item.id === submission.transferId) || null;
  }
  const item = {
    id: shortId('tr_'),
    guildId: guild.id,
    developerId: actor.id,
    type: assetKindLabel(submission.kind),
    name: submission.displayName || submission.identifier,
    identifier: submission.identifier,
    notes: `QA approved by ${submission.reviewedBy ? `<@${submission.reviewedBy}>` : 'Quality Assurance'}. QA submission: ${submission.id}`,
    sourceQaId: submission.id,
    requesterId: submission.requesterId || null,
    sourceChannelId: submission.sourceChannelId || null,
    sourceTicketChannelId: submission.sourceTicketChannelId || null,
    status: 'pending',
    createdAt: Date.now(),
    completedAt: null,
    completedBy: null,
  };
  data.transfers.push(item);
  submission.transferId = item.id;
  const asset = data.assets[assetKey(submission.guildId, submission.kind, submission.identifier)];
  if (asset) {
    asset.transferId = item.id;
    asset.transferStatus = 'pending';
    asset.updatedAt = Date.now();
    asset.history.unshift({ at: Date.now(), event: 'Marked for Transfer', actorId: actor.id, transferId: item.id });
  }
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


function normalizeAssetKind(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'vehicle') return 'vehicle';
  if (v === 'ymap' || v === 'map') return 'ymap';
  if (v === 'livery') return 'livery';
  if (v === 'eup') return 'eup';
  if (v === 'script') return 'script';
  if (v === 'department' || v === 'dept') return 'department';
  if (v === 'gang' || v === 'organization' || v === 'org') return 'gang';
  return 'other';
}

function assetKey(guildId, kind, identifier) {
  return `${guildId}:${normalizeAssetKind(kind)}:${String(identifier || '').trim().toLowerCase()}`;
}

function findAssets(guildId, identifier, kind = null) {
  const target = String(identifier || '').trim().toLowerCase();
  return Object.values(data.assets).filter((asset) =>
    asset.guildId === guildId &&
    (!kind || asset.kind === normalizeAssetKind(kind)) &&
    (String(asset.identifier || '').toLowerCase() === target || String(asset.displayName || '').toLowerCase() === target)
  );
}

function upsertAssetFromSubmission(submission) {
  const key = assetKey(submission.guildId, submission.kind, submission.identifier);
  const existing = data.assets[key] || { history: [] };
  const asset = {
    ...existing,
    key,
    guildId: submission.guildId,
    kind: normalizeAssetKind(submission.kind),
    identifier: submission.identifier,
    displayName: submission.displayName || existing.displayName || submission.identifier,
    flags: Array.isArray(submission.flags) ? submission.flags : [],
    location: submission.location || null,
    notes: submission.notes || null,
    qaSubmissionId: submission.id,
    qaStatus: submission.status,
    submitterId: submission.submitterId || existing.submitterId || null,
    requesterId: submission.requesterId || existing.requesterId || null,
    sourceChannelId: submission.sourceChannelId || existing.sourceChannelId || null,
    sourceTicketChannelId: submission.sourceTicketChannelId || existing.sourceTicketChannelId || null,
    gameStatus: existing.gameStatus || 'not_in_game',
    inGameAt: existing.inGameAt || null,
    inGameBy: existing.inGameBy || null,
    reviewedBy: submission.reviewedBy || null,
    reviewReason: submission.reviewReason || null,
    reviewedAt: submission.reviewedAt || null,
    transferId: submission.transferId || existing.transferId || null,
    transferStatus: submission.transferId ? 'pending' : (existing.transferStatus || 'not_marked'),
    updatedAt: Date.now(),
    createdAt: existing.createdAt || submission.createdAt || Date.now(),
    history: Array.isArray(existing.history) ? existing.history : [],
  };
  asset.history.unshift({
    at: Date.now(),
    event: `QA ${submission.status}`,
    actorId: submission.reviewedBy || submission.submitterId,
    qaSubmissionId: submission.id,
    reason: submission.reviewReason || null,
  });
  asset.history = asset.history.slice(0, 50);
  data.assets[key] = asset;
  return asset;
}

function assetEmbed(asset) {
  const typeLabel = assetKindLabel(asset.kind);
  const embed = new EmbedBuilder()
    .setTitle(`${typeLabel} Asset Record`)
    .addFields(
      { name: 'Identifier', value: `\`${truncate(asset.identifier, 200)}\``, inline: true },
      { name: 'QA Status', value: asset.qaStatus || 'Not Submitted', inline: true },
      { name: 'Transfer Status', value: asset.transferStatus || 'not_marked', inline: true },
      { name: 'In-Game Status', value: asset.gameStatus === 'in_game' ? 'In Game' : 'Not In Game', inline: true },
      { name: 'Name', value: truncate(asset.displayName || asset.identifier), inline: true },
      { name: 'Last Updated', value: asset.updatedAt ? `<t:${Math.floor(asset.updatedAt / 1000)}:R>` : 'Unknown', inline: true },
    )
    .setTimestamp(new Date(asset.updatedAt || Date.now()));
  if (asset.flags?.length) embed.addFields({ name: 'Flags', value: truncate(asset.flags.join(', ')), inline: false });
  if (asset.location) embed.addFields({ name: 'Location', value: truncate(asset.location), inline: false });
  if (asset.requesterId) embed.addFields({ name: 'Original Requester', value: `<@${asset.requesterId}>`, inline: true });
  if (asset.inGameAt) embed.addFields({ name: 'Added In Game', value: `<t:${Math.floor(asset.inGameAt / 1000)}:F>`, inline: true });
  if (asset.reviewedBy) embed.addFields({ name: 'Last QA Reviewer', value: `<@${asset.reviewedBy}>`, inline: true });
  if (asset.reviewReason) embed.addFields({ name: 'Last QA Reason', value: truncate(asset.reviewReason), inline: false });
  if (asset.qaSubmissionId) embed.addFields({ name: 'QA Submission ID', value: `\`${asset.qaSubmissionId}\``, inline: true });
  if (asset.transferId) embed.addFields({ name: 'Transfer ID', value: `\`${asset.transferId}\``, inline: true });
  return embed;
}

async function handleAssetInGame(interaction, identifier, kind = null, notes = null) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.inGuild() || !isTransferManager(interaction.member)) return interaction.editReply('Transfer Manager permission is required.');

  const normalizedKind = kind ? normalizeAssetKind(kind) : null;
  const matches = findAssets(interaction.guildId, identifier, normalizedKind);
  if (!matches.length) {
    return interaction.editReply(`No tracked ${normalizedKind ? assetKindLabel(normalizedKind).toLowerCase() : 'development asset'} was found for **${identifier}**. Submit it through QA first so the bot can track the requester and ticket.`);
  }
  if (matches.length > 1 && !normalizedKind) {
    const options = matches.map((asset) => `${assetKindLabel(asset.kind)} - \`${asset.identifier}\``).join('\n');
    return interaction.editReply(`More than one asset matches **${identifier}**. Run /in-game again and select the asset type.\n${options}`);
  }

  const asset = matches[0];
  if (asset.qaStatus !== 'Approved') return interaction.editReply(`${assetKindLabel(asset.kind)} **${asset.identifier}** is not QA approved yet (current status: ${asset.qaStatus || 'Unknown'}).`);
  if (asset.gameStatus === 'in_game') {
    return interaction.editReply(`${assetKindLabel(asset.kind)} **${asset.displayName || asset.identifier}** is already marked as in game${asset.inGameAt ? ` since <t:${Math.floor(asset.inGameAt / 1000)}:F>` : ''}.`);
  }

  const now = Date.now();
  asset.gameStatus = 'in_game';
  asset.inGameAt = now;
  asset.inGameBy = interaction.user.id;
  asset.transferStatus = 'in_game';
  asset.updatedAt = now;
  if (!Array.isArray(asset.history)) asset.history = [];
  asset.history.unshift({ at: now, event: 'Added In Game', actorId: interaction.user.id, notes: notes || null });
  asset.history = asset.history.slice(0, 50);

  let transfer = asset.transferId ? data.transfers.find((item) => item.id === asset.transferId && item.guildId === interaction.guildId) : null;
  let createdBatch = null;
  if (transfer) {
    const wasPending = transfer.status === 'pending';
    transfer.status = 'completed';
    transfer.completedAt = transfer.completedAt || now;
    transfer.completedBy = transfer.completedBy || interaction.user.id;
    transfer.inGameAt = now;
    transfer.inGameBy = interaction.user.id;
    if (wasPending) {
      const alreadyBatched = Object.values(data.transferBatches).some((batch) => Array.isArray(batch.itemIds) && batch.itemIds.includes(transfer.id));
      if (!alreadyBatched) {
        createdBatch = { id: shortId('batch_'), guildId: interaction.guildId, itemIds: [transfer.id], completedAt: now, completedBy: interaction.user.id, source: 'in-game' };
        data.transferBatches[createdBatch.id] = createdBatch;
      }
    }
  }

  const submission = asset.qaSubmissionId ? data.qaSubmissions[asset.qaSubmissionId] : null;
  const ticketChannelId = asset.sourceTicketChannelId || submission?.sourceTicketChannelId || ((asset.sourceChannelId && data.tickets[asset.sourceChannelId]) ? asset.sourceChannelId : null);
  const sourceTicket = ticketChannelId ? data.tickets[ticketChannelId] : null;
  const requesterId = asset.requesterId || submission?.requesterId || sourceTicket?.openerId || asset.submitterId || submission?.submitterId || null;
  asset.requesterId = requesterId;
  asset.sourceTicketChannelId = ticketChannelId || asset.sourceTicketChannelId || null;

  if (!transfer) {
    transfer = {
      id: shortId('tr_'),
      guildId: interaction.guildId,
      developerId: interaction.user.id,
      type: assetKindLabel(asset.kind),
      name: asset.displayName || asset.identifier,
      identifier: asset.identifier,
      notes: notes || 'Marked live directly through /in-game.',
      sourceQaId: asset.qaSubmissionId || null,
      requesterId,
      sourceChannelId: asset.sourceChannelId || submission?.sourceChannelId || null,
      sourceTicketChannelId: ticketChannelId || null,
      status: 'completed',
      createdAt: now,
      completedAt: now,
      completedBy: interaction.user.id,
      inGameAt: now,
      inGameBy: interaction.user.id,
    };
    data.transfers.push(transfer);
    asset.transferId = transfer.id;
    createdBatch = { id: shortId('batch_'), guildId: interaction.guildId, itemIds: [transfer.id], completedAt: now, completedBy: interaction.user.id, source: 'in-game-direct' };
    data.transferBatches[createdBatch.id] = createdBatch;
  }

  if (sourceTicket && sourceTicket.status !== 'closed') {
    sourceTicket.status = 'completed';
    sourceTicket.statusUpdatedAt = now;
    sourceTicket.statusUpdatedBy = interaction.user.id;
  }
  saveData();

  const typeLabel = assetKindLabel(asset.kind);
  const resultEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(`✅ ${typeLabel} Is Now In Game`)
    .setDescription(`Your **${typeLabel.toLowerCase()}** has been completed, transferred, and is now live in the server.`)
    .addFields(
      { name: assetIdentifierLabel(asset.kind), value: `\`${truncate(asset.identifier, 200)}\``, inline: true },
      { name: 'Name', value: truncate(asset.displayName || asset.identifier), inline: true },
      { name: 'Status', value: '✅ In Game', inline: true },
      { name: 'Deployed By', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Deployed At', value: `<t:${Math.floor(now / 1000)}:F>`, inline: true },
    )
    .setFooter({ text: 'WCRP Development Operations' })
    .setTimestamp(new Date(now));
  if (notes) resultEmbed.addFields({ name: 'Deployment Notes', value: truncate(notes), inline: false });

  let ticketNotified = false;
  const notifyChannelId = ticketChannelId || asset.sourceChannelId || submission?.sourceChannelId;
  if (notifyChannelId) {
    const notifyChannel = await interaction.guild.channels.fetch(notifyChannelId).catch(() => null);
    if (notifyChannel?.isTextBased()) {
      if (sourceTicket && notifyChannel.id === sourceTicket.channelId) await refreshTicketPanel(notifyChannel, sourceTicket).catch(() => null);
      await notifyChannel.send({
        content: requesterId ? `<@${requesterId}> your **${typeLabel}** is now live in game.` : undefined,
        embeds: [resultEmbed],
        allowedMentions: { users: requesterId ? [requesterId] : [] },
      }).then(() => { ticketNotified = true; }).catch(() => null);
    }
  }

  let dmDelivered = false;
  if (requesterId) {
    const requester = await client.users.fetch(requesterId).catch(() => null);
    if (requester) {
      dmDelivered = await requester.send({
        content: `Your ${typeLabel.toLowerCase()} **${asset.displayName || asset.identifier}** is now live in **${interaction.guild.name}**.`,
        embeds: [resultEmbed],
      }).then(() => true).catch(() => false);
    }
  }

  await sendConfiguredLog(interaction.guild, 'transfer', {
    embeds: [auditEmbed(`${typeLabel} Added In Game`, interaction.user, [
      { name: assetIdentifierLabel(asset.kind), value: `\`${truncate(asset.identifier, 200)}\``, inline: true },
      { name: 'Requester', value: requesterId ? `<@${requesterId}>` : 'Unknown', inline: true },
      { name: 'Ticket Notified', value: ticketNotified ? 'Yes' : 'No / unavailable', inline: true },
      { name: 'DM Delivered', value: dmDelivered ? 'Yes' : 'No / unavailable', inline: true },
      { name: 'Transfer', value: transfer ? `\`${transfer.id}\`` : 'No linked transfer record', inline: true },
      { name: 'Batch', value: createdBatch ? `\`${createdBatch.id}\`` : 'Existing / not created', inline: true },
      ...(notes ? [{ name: 'Notes', value: truncate(notes), inline: false }] : []),
    ])],
  });

  return interaction.editReply(`Marked **${asset.displayName || asset.identifier}** (${typeLabel}) as in game.${ticketNotified ? ' The original ticket/source channel received the green in-game confirmation.' : ''}${requesterId ? (dmDelivered ? ' The requester was also DMed.' : ' I could not DM the requester.') : ' No original requester was found.'}`);
}

function taskStatusLabel(status) {
  return ({ backlog: 'Backlog', in_progress: 'In Progress', blocked: 'Blocked', qa: 'Ready for QA', complete: 'Complete' })[status] || status;
}

function taskPriorityLabel(priority) {
  return ({ low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' })[priority] || priority;
}

function taskEmbed(task) {
  const embed = new EmbedBuilder()
    .setTitle(`Development Task - ${task.title}`)
    .setDescription(truncate(task.description, 4000))
    .addFields(
      { name: 'Task ID', value: `\`${task.id}\``, inline: true },
      { name: 'Type', value: task.type, inline: true },
      { name: 'Priority', value: taskPriorityLabel(task.priority), inline: true },
      { name: 'Status', value: taskStatusLabel(task.status), inline: true },
      { name: 'Assigned Developer', value: task.assigneeId ? `<@${task.assigneeId}>` : 'Unassigned', inline: true },
      { name: 'Created By', value: `<@${task.createdBy}>`, inline: true },
    )
    .setTimestamp(new Date(task.updatedAt || task.createdAt));
  if (task.dueAt) embed.addFields({ name: 'Due Date', value: `<t:${Math.floor(task.dueAt / 1000)}:D> (<t:${Math.floor(task.dueAt / 1000)}:R>)`, inline: true });
  if (task.blockReason) embed.addFields({ name: 'Blocker', value: truncate(task.blockReason), inline: false });
  if (task.notes?.length) embed.addFields({ name: 'Recent Notes', value: task.notes.slice(0, 4).map((n) => `<t:${Math.floor(n.at / 1000)}:d> <@${n.authorId}>: ${truncate(n.text, 220)}`).join('\n'), inline: false });
  return embed;
}

function getTask(guildId, id) {
  const task = data.tasks[id];
  return task && task.guildId === guildId ? task : null;
}

function pushTaskHistory(task, action, actor, details = {}) {
  if (!Array.isArray(task.history)) task.history = [];
  task.history.unshift({ action, actorId: actor.id, at: Date.now(), ...details });
  task.history = task.history.slice(0, 100);
  task.updatedAt = Date.now();
}

async function logTaskAction(guild, title, actor, task, extra = []) {
  return sendConfiguredLog(guild, 'dev', {
    embeds: [auditEmbed(title, actor, [
      { name: 'Task', value: `\`${task.id}\` - ${truncate(task.title, 150)}`, inline: false },
      { name: 'Status', value: taskStatusLabel(task.status), inline: true },
      { name: 'Priority', value: taskPriorityLabel(task.priority), inline: true },
      { name: 'Assigned', value: task.assigneeId ? `<@${task.assigneeId}>` : 'Unassigned', inline: true },
      ...extra,
    ])],
  });
}

function parseDueDate(value) {
  if (!value) return null;
  const dt = DateTime.fromISO(value, { zone: TIMEZONE }).endOf('day');
  return dt.isValid ? dt.toMillis() : null;
}

async function configHealthEmbed(guild) {
  const config = guildConfig(guild.id);
  const checks = [];
  const checkChannel = async (label, id) => {
    if (!id) return checks.push(`FAIL - ${label}: not configured`);
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (!channel) return checks.push(`FAIL - ${label}: configured channel no longer exists`);
    const me = guild.members.me;
    const perms = channel.permissionsFor(me);
    const ok = perms?.has(PermissionFlagsBits.ViewChannel) && perms?.has(PermissionFlagsBits.SendMessages);
    checks.push(`${ok ? 'OK' : 'FAIL'} - ${label}: <#${id}>${ok ? '' : ' (bot cannot view/send)'}`);
  };
  const checkRoles = (label, ids) => {
    if (!ids?.length) return checks.push(`WARN - ${label}: no roles configured`);
    const missing = ids.filter((id) => !guild.roles.cache.has(id));
    checks.push(`${missing.length ? 'FAIL' : 'OK'} - ${label}: ${missing.length ? `${missing.length} missing role(s)` : `${ids.length} configured`}`);
  };
  const checkCategory = async (label, id) => {
    if (!id) return checks.push(`WARN - ${label}: not configured`);
    const channel = await guild.channels.fetch(id).catch(() => null);
    checks.push(`${channel?.type === ChannelType.GuildCategory ? 'OK' : 'FAIL'} - ${label}: ${channel ? `<#${id}>` : 'configured category no longer exists'}`);
  };
  checkRoles('Developer access', config.developerRoleIds);
  checkRoles('QA reviewers', config.qaRoleIds);
  checkRoles('Transfer managers', config.transferRoleIds);
  checkRoles('Staff managers', config.staffManagerRoleIds);
  checkRoles('LEO ticket handler', ticketHandlerRoleIds(config, 'leo'));
  checkRoles('Livery ticket handler', ticketHandlerRoleIds(config, 'livery'));
  checkRoles('Commission ticket handler', ticketHandlerRoleIds(config, 'commission'));
  checkRoles('QA ticket handler', ticketHandlerRoleIds(config, 'qa'));
  checkRoles('Department ticket handler', ticketHandlerRoleIds(config, 'department'));
  checkRoles('Gang ticket handler', ticketHandlerRoleIds(config, 'gang'));
  await checkCategory('Department ticket category', config.departmentCategoryId);
  await checkCategory('Gang ticket category', config.gangCategoryId);
  await checkChannel('QA submissions', config.qaChannelId);
  if (!config.qaNotificationRoleId) checks.push('WARN - QA submission notification role: not configured (new QA submissions will not ping a QA role)');
  else if (!guild.roles.cache.has(config.qaNotificationRoleId)) checks.push('FAIL - QA submission notification role: configured role no longer exists');
  else checks.push(`OK - QA submission notification role: <@&${config.qaNotificationRoleId}>`);
  await checkChannel('Development staff movement', config.developerMovementChannelId);
  await checkChannel('QA staff movement', config.qaMovementChannelId);
  await checkChannel('Saturday transfer', config.transferChannelId);
  await checkChannel('Ticket/transcript logs', config.ticketLogChannelId || config.logChannelId);
  await checkChannel('QA logs', config.qaLogChannelId || config.logChannelId);
  await checkChannel('Transfer logs', config.transferLogChannelId || config.logChannelId);
  await checkChannel('Development operations logs', config.devLogChannelId || config.configLogChannelId || config.logChannelId);
  await checkChannel('Agreement logs', config.agreementLogChannelId || config.staffLogChannelId || config.logChannelId);
  checks.push(`OK - Agreement version: ${config.agreementVersion}${config.agreementRequiredBeforeHire ? ' (required before hire)' : ' (not enforced before hire)'}`);
  const me = guild.members.me;
  checks.push(`${me?.permissions.has(PermissionFlagsBits.ManageRoles) ? 'OK' : 'FAIL'} - Manage Roles permission`);
  checks.push(`${me?.permissions.has(PermissionFlagsBits.ManageChannels) ? 'OK' : 'FAIL'} - Manage Channels permission`);
  checks.push(`${me?.permissions.has(PermissionFlagsBits.ManageThreads) ? 'OK' : 'WARN'} - Manage Threads permission`);
  return new EmbedBuilder().setTitle('Development Bot Configuration Health').setDescription(checks.join('\n').slice(0, 4000)).setTimestamp();
}

function latestTransferBatch(guildId) {
  return Object.values(data.transferBatches)
    .filter((batch) => batch.guildId === guildId)
    .sort((a, b) => b.completedAt - a.completedAt)[0] || null;
}

function releaseNotesEmbed(batch, items) {
  const embed = new EmbedBuilder()
    .setTitle(`Development Release Notes - ${batch.id}`)
    .setDescription(`Completed <t:${Math.floor(batch.completedAt / 1000)}:F> by <@${batch.completedBy}>.`)
    .setTimestamp(new Date(batch.completedAt));
  const grouped = new Map();
  for (const item of items) {
    const list = grouped.get(item.type) || [];
    list.push(`- **${item.name}**${item.identifier ? ` (\`${item.identifier}\`)` : ''}`);
    grouped.set(item.type, list);
  }
  for (const [type, lines] of grouped) embed.addFields({ name: type, value: truncate(lines.join('\n'), 1024), inline: false });
  if (!items.length) embed.addFields({ name: 'Items', value: 'No transfer items found for this batch.' });
  return embed;
}

function developmentPanel() {
  const embed = new EmbedBuilder()
    .setTitle('WCRP Development Support')
    .setDescription('Select the type of development request you need. The button opens a guided form, then the bot creates a private ticket and routes it only to the configured handler role for that ticket type.')
    .addFields(
      { name: 'LEO Ticket', value: 'Vehicle changes, emergency equipment, and other LEO development requests.', inline: false },
      { name: 'Livery Ticket', value: 'Vehicle livery design, revisions, branding, and texture requests.', inline: false },
      { name: 'Custom Commission', value: 'Custom vehicles, scripts, maps, EUP, liveries, and other development work.', inline: false },
      { name: 'Quality Assurance', value: 'Testing issues, validation requests, evidence, and QA support.', inline: false },
      { name: 'Department Request', value: 'Purchased/custom department packages, branding, vehicles, EUP, liveries, maps, and setup work.', inline: false },
      { name: 'Gang Request', value: 'Purchased/custom gang packages, branding, vehicles, EUP, liveries, maps, and setup work.', inline: false },
    );
  const primaryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_ticket:leo').setLabel('LEO Ticket').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('open_ticket:livery').setLabel('Livery Ticket').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('open_ticket:commission').setLabel('Custom Commission').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('open_ticket:qa').setLabel('Quality Assurance').setStyle(ButtonStyle.Secondary),
  );
  const communityRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('open_ticket:department').setLabel('Department Request').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('open_ticket:gang').setLabel('Gang Request').setStyle(ButtonStyle.Success),
  );
  return { embeds: [embed], components: [primaryRow, communityRow] };
}

const roleTypeChoices = [
  { name: 'Developer Command Access', value: 'developer' },
  { name: 'Quality Assurance Reviewer', value: 'qa' },
  { name: 'LEO Ticket Handler', value: 'leo_handler' },
  { name: 'Livery Ticket Handler', value: 'livery_handler' },
  { name: 'Commission Ticket Handler', value: 'commission_handler' },
  { name: 'QA Ticket Handler', value: 'qa_ticket_handler' },
  { name: 'Department Ticket Handler', value: 'department_handler' },
  { name: 'Gang Ticket Handler', value: 'gang_handler' },
  { name: 'Transfer Manager', value: 'transfer' },
];
const categoryTypeChoices = [
  { name: 'LEO Tickets', value: 'leo' },
  { name: 'Livery Tickets', value: 'livery' },
  { name: 'Custom Commissions', value: 'commission' },
  { name: 'Quality Assurance Tickets', value: 'qa' },
  { name: 'Department Requests', value: 'department' },
  { name: 'Gang Requests', value: 'gang' },
];
const channelTypeChoices = [
  { name: 'Quality Assurance Submissions', value: 'qa' },
  { name: 'Saturday Transfer', value: 'transfer' },
  { name: 'Ticket / Transcript Logs', value: 'ticket_log' },
  { name: 'Quality Assurance Logs', value: 'qa_log' },
  { name: 'Transfer Logs', value: 'transfer_log' },
  { name: 'Configuration Logs', value: 'config_log' },
  { name: 'Role Sync Logs', value: 'role_sync_log' },
  { name: 'Staff Management Logs', value: 'staff_log' },
  { name: 'Development Operations Logs', value: 'dev_log' },
  { name: 'Legacy / Fallback Log Channel', value: 'log' },
];


const staffTeamChoices = [
  { name: 'Development Team', value: 'developer' },
  { name: 'Quality Assurance', value: 'qa' },
];
const staffStatusRoleChoices = [
  { name: 'Suspended', value: 'suspended' },
  { name: 'Removed / Former Staff', value: 'removed' },
  { name: 'Blacklisted', value: 'blacklisted' },
];
const pendingStaffFlow = new Map();

function staffManagementPanel() {
  const embed = new EmbedBuilder()
    .setTitle('WCRP Development Staff Management')
    .setDescription('Authorized development management can use the controls below to manage Development Team and Quality Assurance staff. Every action is recorded in the configured staff log and the member history.')
    .addFields(
      { name: 'Hiring and Rank Changes', value: 'Hire, promote, or demote a member using the configured rank roles.', inline: false },
      { name: 'Disciplinary Actions', value: 'Suspend, remove, or blacklist a staff member with a required reason.', inline: false },
      { name: 'Restoration', value: 'Unsuspend or remove a blacklist when management authorizes the member to return.', inline: false },
    );
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('staff_action:hire').setLabel('Hire').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('staff_action:promote').setLabel('Promote').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('staff_action:demote').setLabel('Demote').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('staff_action:suspend').setLabel('Suspend').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('staff_action:remove').setLabel('Remove').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('staff_action:blacklist').setLabel('Blacklist').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('staff_action:unsuspend').setLabel('Unsuspend').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('staff_action:unblacklist').setLabel('Remove Blacklist').setStyle(ButtonStyle.Success),
  );
  return { embeds: [embed], components: [row1, row2] };
}

function newStaffFlow(interaction, action) {
  const key = shortId('sf_');
  pendingStaffFlow.set(key, { key, guildId: interaction.guildId, actorId: interaction.user.id, action, team: null, userId: null, rankRoleId: null, createdAt: Date.now() });
  setTimeout(() => pendingStaffFlow.delete(key), 10 * 60 * 1000).unref?.();
  return key;
}

function staffTeamMenu(key) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`staff_team:${key}`).setPlaceholder('Select the team').addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Development Team').setValue('developer'),
      new StringSelectMenuOptionBuilder().setLabel('Quality Assurance').setValue('qa'),
    ),
  );
}

function staffUserMenu(key) {
  return new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder().setCustomId(`staff_user:${key}`).setPlaceholder('Select the staff member').setMinValues(1).setMaxValues(1),
  );
}

function staffRankMenu(key, config, team) {
  const ids = teamRanks(config, team).slice(0, 25);
  const options = ids.map((id) => {
    const role = client.guilds.cache.get(pendingStaffFlow.get(key)?.guildId)?.roles.cache.get(id);
    return new StringSelectMenuOptionBuilder().setLabel((role?.name || id).slice(0, 100)).setValue(id).setDescription(role ? `Role ID: ${id}`.slice(0, 100) : 'Configured role is missing');
  });
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`staff_rank:${key}`).setPlaceholder(`Select the ${teamLabel(team)} rank`).addOptions(...options),
  );
}

function staffReasonModal(key, action) {
  const titles = { hire: 'Hire Staff Member', promote: 'Promote Staff Member', demote: 'Demote Staff Member', suspend: 'Suspend Staff Member', remove: 'Remove Staff Member', blacklist: 'Blacklist Staff Member', unsuspend: 'Unsuspend Staff Member', unblacklist: 'Remove Staff Blacklist' };
  const input = new TextInputBuilder().setCustomId('reason').setLabel('Reason / Management Notes').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
  return new ModalBuilder().setCustomId(`staff_reason:${key}`).setTitle(titles[action] || 'Staff Management').addComponents(new ActionRowBuilder().addComponents(input));
}

function staffActionTitle(action) {
  return { hire: 'Staff Member Hired', promote: 'Staff Member Promoted', demote: 'Staff Member Demoted', suspend: 'Staff Member Suspended', unsuspend: 'Staff Member Unsuspended', remove: 'Staff Member Removed', blacklist: 'Staff Member Blacklisted', unblacklist: 'Staff Blacklist Removed' }[action] || 'Staff Management Action';
}

function otherTeam(team) { return team === 'qa' ? 'developer' : 'qa'; }

async function performStaffAction({ guild, actor, targetUserId, team, action, rankRoleId = null, reason }) {
  const config = guildConfig(guild.id);
  const member = await fetchMember(guild, targetUserId);
  if (!member) throw new Error('That user is not currently a member of this server.');
  const record = staffRecord(guild.id, targetUserId);
  const teamRecord = record[team];
  const other = record[otherTeam(team)];
  const beforeStatus = teamRecord.status;
  const beforeRank = teamRecord.rankRoleId;

  if (action === 'hire' && config.agreementRequiredBeforeHire && !hasCurrentAgreement(guild.id, targetUserId, team)) {
    throw new Error(`This member must sign the current privileged access agreement (${config.agreementVersion}) before they can be hired. Use /agreement send first.`);
  }

  if (['hire', 'promote', 'demote'].includes(action)) {
    if (['promote', 'demote'].includes(action) && teamRecord.status !== 'active') throw new Error(`This member is not currently active in the ${teamLabel(team)}.`);
    if (teamRecord.status === 'blacklisted') throw new Error(`This member is blacklisted from the ${teamLabel(team)}. Remove the blacklist first.`);
    if (!rankRoleId) throw new Error('A configured rank role is required for this action.');
    await setTeamRank(member, config, team, rankRoleId);
    teamRecord.previousRankRoleId = beforeRank;
    teamRecord.rankRoleId = rankRoleId;
    teamRecord.status = 'active';
    if (!teamRecord.hiredAt) { teamRecord.hiredAt = Date.now(); teamRecord.hiredBy = actor.id; }
    if (config.suspendedRoleId && other.status !== 'suspended') await removeRoleIfPossible(member, config.suspendedRoleId);
    if (config.removedRoleId && other.status !== 'removed') await removeRoleIfPossible(member, config.removedRoleId);
    if (config.blacklistedRoleId && other.status !== 'blacklisted') await removeRoleIfPossible(member, config.blacklistedRoleId);
  } else if (action === 'suspend') {
    if (teamRecord.status !== 'active') throw new Error(`This member is not currently active in the ${teamLabel(team)}.`);
    teamRecord.previousRankRoleId = teamRecord.rankRoleId;
    await clearConfiguredTeamRoles(member, config, team);
    if (config.suspendedRoleId) await addRoleIfPossible(member, config.suspendedRoleId);
    teamRecord.status = 'suspended';
  } else if (action === 'unsuspend') {
    if (teamRecord.status !== 'suspended') throw new Error(`This member is not suspended from the ${teamLabel(team)}.`);
    const restoreRank = teamRecord.previousRankRoleId || teamRecord.rankRoleId;
    if (!restoreRank || !teamRanks(config, team).includes(restoreRank)) throw new Error(`No valid previous ${teamLabel(team)} rank is stored. Use /hire or /promote with the correct rank instead.`);
    await setTeamRank(member, config, team, restoreRank);
    teamRecord.rankRoleId = restoreRank;
    teamRecord.status = 'active';
    if (config.suspendedRoleId && other.status !== 'suspended') await removeRoleIfPossible(member, config.suspendedRoleId);
  } else if (action === 'remove') {
    await clearConfiguredTeamRoles(member, config, team);
    if (config.suspendedRoleId && other.status !== 'suspended') await removeRoleIfPossible(member, config.suspendedRoleId);
    if (config.removedRoleId) await addRoleIfPossible(member, config.removedRoleId);
    teamRecord.previousRankRoleId = teamRecord.rankRoleId;
    teamRecord.status = 'removed';
  } else if (action === 'blacklist') {
    await clearConfiguredTeamRoles(member, config, team);
    if (config.suspendedRoleId && other.status !== 'suspended') await removeRoleIfPossible(member, config.suspendedRoleId);
    if (config.removedRoleId && other.status !== 'removed') await removeRoleIfPossible(member, config.removedRoleId);
    if (config.blacklistedRoleId) await addRoleIfPossible(member, config.blacklistedRoleId);
    teamRecord.previousRankRoleId = teamRecord.rankRoleId;
    teamRecord.status = 'blacklisted';
  } else if (action === 'unblacklist') {
    if (teamRecord.status !== 'blacklisted') throw new Error(`This member is not blacklisted from the ${teamLabel(team)}.`);
    teamRecord.status = 'none';
    if (config.blacklistedRoleId && other.status !== 'blacklisted') await removeRoleIfPossible(member, config.blacklistedRoleId);
  } else {
    throw new Error('Unknown staff management action.');
  }

  teamRecord.updatedAt = Date.now();
  pushStaffHistory(record, action, team, actor, reason, { beforeStatus, afterStatus: teamRecord.status, beforeRankRoleId: beforeRank, afterRankRoleId: teamRecord.rankRoleId });
  saveData();

  const dmDelivered = await notifyStaffMember({ guild, member, actor, team, action, reason, teamRecord });
  const fields = [];
  if (teamRecord.rankRoleId) fields.push({ name: 'Current Rank', value: `<@&${teamRecord.rankRoleId}>`, inline: true });
  fields.push({ name: 'Status', value: teamRecord.status, inline: true });
  await logStaffAction(guild, staffActionTitle(action), actor, targetUserId, team, reason, fields, { action, rankRoleId: teamRecord.rankRoleId, dmDelivered });
  await postStaffMovementAnnouncement({ guild, actor, targetId: targetUserId, team, action, reason, rankRoleId: teamRecord.rankRoleId });
  return { member, record, teamRecord, dmDelivered };
}

async function handleStaffConfig(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.inGuild() || !isAdmin(interaction)) return interaction.editReply('Administrator permission is required.');
  const config = guildConfig(interaction.guildId);
  const sub = interaction.options.getSubcommand();
  if (sub === 'add-manager' || sub === 'remove-manager') {
    const role = interaction.options.getRole('role', true);
    config.staffManagerRoleIds = sub === 'add-manager' ? [...new Set([...config.staffManagerRoleIds, role.id])] : config.staffManagerRoleIds.filter((id) => id !== role.id);
    saveData();
    await sendConfiguredLog(interaction.guild, 'config', { embeds: [auditEmbed('Staff Management Configuration Changed', interaction.user, [{ name: 'Action', value: sub === 'add-manager' ? 'Manager Role Added' : 'Manager Role Removed', inline: true }, { name: 'Role', value: `<@&${role.id}>`, inline: true }])] });
    return interaction.editReply(`Staff manager roles: ${config.staffManagerRoleIds.length ? config.staffManagerRoleIds.map((id) => `<@&${id}>`).join(', ') : 'None'}`);
  }
  if (sub === 'add-rank' || sub === 'remove-rank') {
    const team = interaction.options.getString('team', true);
    const role = interaction.options.getRole('role', true);
    const key = team === 'qa' ? 'qaRankRoleIds' : 'developerRankRoleIds';
    const accessKey = team === 'qa' ? 'qaRoleIds' : 'developerRoleIds';
    if (sub === 'add-rank') {
      config[key] = [...new Set([...config[key], role.id])];
      config[accessKey] = [...new Set([...config[accessKey], role.id])];
    } else {
      config[key] = config[key].filter((id) => id !== role.id);
      config[accessKey] = config[accessKey].filter((id) => id !== role.id || id === teamBaseRoleId(config, team));
    }
    saveData();
    await sendConfiguredLog(interaction.guild, 'config', { embeds: [auditEmbed('Staff Rank Configuration Changed', interaction.user, [{ name: 'Team', value: teamLabel(team), inline: true }, { name: 'Action', value: sub === 'add-rank' ? 'Rank Added' : 'Rank Removed', inline: true }, { name: 'Role', value: `<@&${role.id}>`, inline: true }])] });
    return interaction.editReply(`${teamLabel(team)} ranks: ${config[key].length ? config[key].map((id) => `<@&${id}>`).join(', ') : 'None'}`);
  }
  if (sub === 'set-base-role') {
    const team = interaction.options.getString('team', true);
    const role = interaction.options.getRole('role', true);
    if (team === 'qa') {
      config.qaBaseRoleId = role.id;
      config.qaRoleIds = [...new Set([...config.qaRoleIds, role.id])];
    } else {
      config.developerBaseRoleId = role.id;
      config.developerRoleIds = [...new Set([...config.developerRoleIds, role.id])];
    }
    saveData();
    await sendConfiguredLog(interaction.guild, 'config', { embeds: [auditEmbed('Staff Base Role Configured', interaction.user, [{ name: 'Team', value: teamLabel(team), inline: true }, { name: 'Role', value: `<@&${role.id}>`, inline: true }])] });
    return interaction.editReply(`${teamLabel(team)} base role set to <@&${role.id}>. It was also added to that team's command-access roles.`);
  }
  if (sub === 'set-status-role') {
    const type = interaction.options.getString('type', true);
    const role = interaction.options.getRole('role', true);
    const key = { suspended: 'suspendedRoleId', removed: 'removedRoleId', blacklisted: 'blacklistedRoleId' }[type];
    config[key] = role.id; saveData();
    await sendConfiguredLog(interaction.guild, 'config', { embeds: [auditEmbed('Staff Status Role Configured', interaction.user, [{ name: 'Status', value: type, inline: true }, { name: 'Role', value: `<@&${role.id}>`, inline: true }])] });
    return interaction.editReply(`${type} role set to <@&${role.id}>.`);
  }
  if (sub === 'set-log-channel') {
    const channel = interaction.options.getChannel('channel', true); config.staffLogChannelId = channel.id; saveData();
    await sendConfiguredLog(interaction.guild, 'config', { embeds: [auditEmbed('Staff Log Channel Configured', interaction.user, [{ name: 'Channel', value: `<#${channel.id}>`, inline: true }])] });
    return interaction.editReply(`Staff management log channel set to <#${channel.id}>.`);
  }
  if (sub === 'set-movement-channel') {
    const team = interaction.options.getString('team', true);
    const channel = interaction.options.getChannel('channel', true);
    if (team === 'qa') config.qaMovementChannelId = channel.id;
    else config.developerMovementChannelId = channel.id;
    saveData();
    await sendConfiguredLog(interaction.guild, 'config', { embeds: [auditEmbed('Staff Movement Channel Configured', interaction.user, [
      { name: 'Team', value: teamLabel(team), inline: true },
      { name: 'Channel', value: `<#${channel.id}>`, inline: true },
    ])] });
    return interaction.editReply(`${teamLabel(team)} hiring / movement channel set to <#${channel.id}>.`);
  }
  if (sub === 'set-qa-notification-role') {
    const role = interaction.options.getRole('role', true);
    config.qaNotificationRoleId = role.id;
    saveData();
    await sendConfiguredLog(interaction.guild, 'config', { embeds: [auditEmbed('QA Notification Role Configured', interaction.user, [
      { name: 'Role', value: `<@&${role.id}>`, inline: true },
      { name: 'Purpose', value: 'Only this role is pinged for new QA submissions.', inline: false },
    ])] });
    return interaction.editReply(`QA submission notification role set to <@&${role.id}>. Only this role will be pinged on new QA submissions.`);
  }
  if (sub === 'set-agreement-log-channel') {
    const channel = interaction.options.getChannel('channel', true);
    config.agreementLogChannelId = channel.id;
    saveData();
    await sendConfiguredLog(interaction.guild, 'config', { embeds: [auditEmbed('Agreement Log Channel Configured', interaction.user, [{ name: 'Channel', value: `<#${channel.id}>`, inline: true }])] });
    return interaction.editReply(`Privileged-access agreement log channel set to <#${channel.id}>.`);
  }
  if (sub === 'set-agreement-version') {
    const version = interaction.options.getString('version', true).trim();
    if (!version) return interaction.editReply('Agreement version cannot be blank.');
    const previous = config.agreementVersion;
    config.agreementVersion = version;
    saveData();
    await sendConfiguredLog(interaction.guild, 'config', { embeds: [auditEmbed('Agreement Version Changed', interaction.user, [
      { name: 'Previous Version', value: previous, inline: true },
      { name: 'New Version', value: version, inline: true },
      { name: 'Effect', value: 'Existing signatures remain in history, but members must sign the new version before a new hire/reinstatement when agreement enforcement is enabled.', inline: false },
    ])] });
    return interaction.editReply(`Agreement version changed from **${previous}** to **${version}**. Existing signatures are retained as history but are not current for the new version.`);
  }
  if (sub === 'set-agreement-required') {
    config.agreementRequiredBeforeHire = interaction.options.getBoolean('required', true);
    saveData();
    await sendConfiguredLog(interaction.guild, 'config', { embeds: [auditEmbed('Agreement Hiring Requirement Changed', interaction.user, [{ name: 'Required Before Hire', value: config.agreementRequiredBeforeHire ? 'Yes' : 'No', inline: true }])] });
    return interaction.editReply(`Current signed agreement is now **${config.agreementRequiredBeforeHire ? 'required' : 'not required'}** before /hire grants Development/QA access.`);
  }
  if (sub === 'view') {
    const showRoles = (ids) => ids.length ? ids.map((id) => `<@&${id}>`).join(', ') : 'Not configured';
    const showRole = (id) => id ? `<@&${id}>` : 'Not configured';
    const embed = new EmbedBuilder().setTitle('Staff Management Configuration').addFields(
      { name: 'Management Roles', value: showRoles(config.staffManagerRoleIds) },
      { name: 'Developer Base Role', value: showRole(config.developerBaseRoleId), inline: true },
      { name: 'QA Base Role', value: showRole(config.qaBaseRoleId), inline: true },
      { name: 'Developer Ranks', value: showRoles(config.developerRankRoleIds) },
      { name: 'QA Ranks', value: showRoles(config.qaRankRoleIds) },
      { name: 'Suspended Role', value: showRole(config.suspendedRoleId), inline: true },
      { name: 'Removed Role', value: showRole(config.removedRoleId), inline: true },
      { name: 'Blacklisted Role', value: showRole(config.blacklistedRoleId), inline: true },
      { name: 'Staff Log Channel', value: config.staffLogChannelId ? `<#${config.staffLogChannelId}>` : 'Not configured' },
      { name: 'Development Movement Channel', value: config.developerMovementChannelId ? `<#${config.developerMovementChannelId}>` : 'Not configured', inline: true },
      { name: 'QA Movement Channel', value: config.qaMovementChannelId ? `<#${config.qaMovementChannelId}>` : 'Not configured', inline: true },
      { name: 'QA Submission Ping Role', value: config.qaNotificationRoleId ? `<@&${config.qaNotificationRoleId}>` : 'Not configured', inline: true },
      { name: 'Agreement Log Channel', value: config.agreementLogChannelId ? `<#${config.agreementLogChannelId}>` : (config.staffLogChannelId ? `Using staff log <#${config.staffLogChannelId}>` : 'Not configured'), inline: true },
      { name: 'Agreement Version', value: config.agreementVersion, inline: true },
      { name: 'Agreement Before Hire', value: config.agreementRequiredBeforeHire ? 'Required' : 'Not enforced', inline: true },
    );
    return interaction.editReply({ embeds: [embed] });
  }
}

function staffProfileEmbed(guild, user, record) {
  const config = guildConfig(guild.id);
  const formatTeam = (team) => {
    const r = record[team];
    const rank = r.rankRoleId ? `<@&${r.rankRoleId}>` : 'None';
    return `Status: **${r.status}**\nRank: ${rank}${r.hiredAt ? `\nHired: <t:${Math.floor(r.hiredAt / 1000)}:D>` : ''}`;
  };
  return new EmbedBuilder().setTitle(`Development Staff Profile - ${user.username}`).setDescription(`<@${user.id}> (${user.id})`).addFields(
    { name: 'Development Team', value: formatTeam('developer'), inline: true },
    { name: 'Quality Assurance', value: formatTeam('qa'), inline: true },
    { name: 'Management Notes', value: record.notes.length ? record.notes.slice(0, 5).map((n) => `<t:${Math.floor(n.at / 1000)}:d> <@${n.authorId}>: ${truncate(n.text, 180)}`).join('\n') : 'No notes recorded.', inline: false },
    { name: 'History Entries', value: String(record.history.length), inline: true },
    { name: 'Configured Status Roles', value: `Suspended: ${config.suspendedRoleId ? `<@&${config.suspendedRoleId}>` : 'None'}\nRemoved: ${config.removedRoleId ? `<@&${config.removedRoleId}>` : 'None'}\nBlacklisted: ${config.blacklistedRoleId ? `<@&${config.blacklistedRoleId}>` : 'None'}`, inline: false },
  ).setTimestamp();
}

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
    .setName('staff-config')
    .setDescription('Configure Development Team and Quality Assurance staff management')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('add-manager').setDescription('Allow a role to manage development staff').addRoleOption((o) => o.setName('role').setDescription('Management role').setRequired(true)))
    .addSubcommand((s) => s.setName('remove-manager').setDescription('Remove a development staff management role').addRoleOption((o) => o.setName('role').setDescription('Management role').setRequired(true)))
    .addSubcommand((s) => s.setName('add-rank').setDescription('Add an allowed staff rank role').addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices)).addRoleOption((o) => o.setName('role').setDescription('Rank role').setRequired(true)))
    .addSubcommand((s) => s.setName('remove-rank').setDescription('Remove an allowed staff rank role').addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices)).addRoleOption((o) => o.setName('role').setDescription('Rank role').setRequired(true)))
    .addSubcommand((s) => s.setName('set-base-role').setDescription('Set the base membership role for a team').addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices)).addRoleOption((o) => o.setName('role').setDescription('Base team role').setRequired(true)))
    .addSubcommand((s) => s.setName('set-status-role').setDescription('Set the role used for suspension, removal, or blacklist status').addStringOption((o) => o.setName('type').setDescription('Status').setRequired(true).addChoices(...staffStatusRoleChoices)).addRoleOption((o) => o.setName('role').setDescription('Status role').setRequired(true)))
    .addSubcommand((s) => s.setName('set-log-channel').setDescription('Set the permanent staff-management log channel').addChannelOption((o) => o.setName('channel').setDescription('Staff log channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('set-movement-channel').setDescription('Set the public hiring / movement channel for Development or QA').addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices)).addChannelOption((o) => o.setName('channel').setDescription('Movement / staffing updates channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('set-qa-notification-role').setDescription('Select the one role pinged for new QA submissions').addRoleOption((o) => o.setName('role').setDescription('QA notification role').setRequired(true)))
    .addSubcommand((s) => s.setName('set-agreement-log-channel').setDescription('Set the permanent privileged-access agreement log channel').addChannelOption((o) => o.setName('channel').setDescription('Agreement audit log channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('set-agreement-version').setDescription('Change the required agreement version; a new version requires a new signature').addStringOption((o) => o.setName('version').setDescription('Version label, e.g. WCRP-DEV-1.1').setRequired(true).setMaxLength(40)))
    .addSubcommand((s) => s.setName('set-agreement-required').setDescription('Require a current signed agreement before /hire can grant staff access').addBooleanOption((o) => o.setName('required').setDescription('Require agreement before hire').setRequired(true)))
    .addSubcommand((s) => s.setName('view').setDescription('View the staff-management configuration')),

  new SlashCommandBuilder()
    .setName('agreement')
    .setDescription('Send and manage the WCRP privileged-access agreement')
    .addSubcommand((s) => s.setName('send').setDescription('DM the current agreement to a Development/QA candidate')
      .addUserOption((o) => o.setName('user').setDescription('Person required to sign').setRequired(true))
      .addStringOption((o) => o.setName('team').setDescription('Access covered by the agreement').setRequired(true).addChoices(
        { name: 'Development Team', value: 'developer' },
        { name: 'Quality Assurance', value: 'qa' },
        { name: 'Development Team & QA', value: 'both' })))
    .addSubcommand((s) => s.setName('status').setDescription('Check a member\'s agreement status').addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('List recent agreement records for this server'))
    .addSubcommand((s) => s.setName('revoke').setDescription('Revoke a member\'s current agreement acknowledgement')
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason for revocation').setRequired(true).setMaxLength(1000)))
    .addSubcommand((s) => s.setName('preview').setDescription('Preview the current agreement text')),

  new SlashCommandBuilder().setName('staff-panel').setDescription('Post the Development Team / QA staff-management panel'),

  new SlashCommandBuilder().setName('hire').setDescription('Hire or reinstate someone into Development Team or Quality Assurance')
    .addUserOption((o) => o.setName('user').setDescription('Member to hire').setRequired(true))
    .addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices))
    .addRoleOption((o) => o.setName('rank').setDescription('Configured rank role').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Hiring / reinstatement reason').setRequired(true)),
  new SlashCommandBuilder().setName('promote').setDescription('Promote a Development Team or QA staff member')
    .addUserOption((o) => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices))
    .addRoleOption((o) => o.setName('rank').setDescription('New configured rank role').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Promotion reason').setRequired(true)),
  new SlashCommandBuilder().setName('demote').setDescription('Demote a Development Team or QA staff member')
    .addUserOption((o) => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices))
    .addRoleOption((o) => o.setName('rank').setDescription('New configured rank role').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Demotion reason').setRequired(true)),
  new SlashCommandBuilder().setName('suspend').setDescription('Suspend a Development Team or QA staff member')
    .addUserOption((o) => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices))
    .addStringOption((o) => o.setName('reason').setDescription('Suspension reason').setRequired(true)),
  new SlashCommandBuilder().setName('unsuspend').setDescription('Restore a suspended Development Team or QA staff member')
    .addUserOption((o) => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for restoration').setRequired(true)),
  new SlashCommandBuilder().setName('remove-staff').setDescription('Remove someone from Development Team or Quality Assurance')
    .addUserOption((o) => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices))
    .addStringOption((o) => o.setName('reason').setDescription('Removal reason').setRequired(true)),
  new SlashCommandBuilder().setName('blacklist-staff').setDescription('Blacklist someone from Development Team or Quality Assurance')
    .addUserOption((o) => o.setName('user').setDescription('Member to blacklist').setRequired(true))
    .addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices))
    .addStringOption((o) => o.setName('reason').setDescription('Blacklist reason').setRequired(true)),
  new SlashCommandBuilder().setName('unblacklist-staff').setDescription('Remove a Development Team or QA blacklist')
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for removing blacklist').setRequired(true)),
  new SlashCommandBuilder().setName('staff-profile').setDescription('View a Development Team / QA staff profile').addUserOption((o) => o.setName('user').setDescription('Staff member').setRequired(true)),
  new SlashCommandBuilder().setName('staff-roster').setDescription('List Development Team or Quality Assurance staff').addStringOption((o) => o.setName('team').setDescription('Team').setRequired(true).addChoices(...staffTeamChoices)),
  new SlashCommandBuilder().setName('staff-note').setDescription('Add a permanent internal note to a staff profile')
    .addUserOption((o) => o.setName('user').setDescription('Staff member').setRequired(true))
    .addStringOption((o) => o.setName('note').setDescription('Internal management note').setRequired(true)),
  new SlashCommandBuilder().setName('staff-history').setDescription('View recent staff-management history for a member').addUserOption((o) => o.setName('user').setDescription('Staff member').setRequired(true)),
  new SlashCommandBuilder().setName('ticket-claim').setDescription('Claim the current development ticket as its handler'),
  new SlashCommandBuilder().setName('ticket-unclaim').setDescription('Remove your/current handler claim from this development ticket'),
  new SlashCommandBuilder().setName('qa-stats').setDescription('View QA review statistics').addUserOption((o) => o.setName('reviewer').setDescription('Optional QA reviewer').setRequired(false)),
  new SlashCommandBuilder().setName('dev-overview').setDescription('View the current Development Utilities operational overview'),

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
    .setName('approve')
    .setDescription('Submit a development asset to Quality Assurance for approval')
    .addSubcommand((sc) => sc.setName('vehicle').setDescription('Submit a vehicle')
      .addStringOption((o) => o.setName('spawn_code').setDescription('Vehicle spawn code').setRequired(true))
      .addStringOption((o) => o.setName('name').setDescription('Vehicle display name').setRequired(false))
      .addStringOption((o) => o.setName('other_flags').setDescription('Additional flags not in the selector').setRequired(false))
      .addStringOption((o) => o.setName('notes').setDescription('Developer notes / testing requirements').setRequired(false)))
    .addSubcommand((sc) => sc.setName('ymap').setDescription('Submit a YMAP / map resource')
      .addStringOption((o) => o.setName('resource').setDescription('Resource or YMAP name').setRequired(true))
      .addStringOption((o) => o.setName('name').setDescription('Human-readable map name').setRequired(false))
      .addStringOption((o) => o.setName('location').setDescription('In-game location').setRequired(false))
      .addStringOption((o) => o.setName('notes').setDescription('Developer notes / testing requirements').setRequired(false)))
    .addSubcommand((sc) => sc.setName('eup').setDescription('Submit an EUP pack/resource')
      .addStringOption((o) => o.setName('resource').setDescription('EUP resource, pack, or identifier').setRequired(true))
      .addStringOption((o) => o.setName('name').setDescription('EUP pack/display name').setRequired(false))
      .addStringOption((o) => o.setName('notes').setDescription('Uniform details, slots, dependencies, testing notes, etc.').setRequired(false)))
    .addSubcommand((sc) => sc.setName('department').setDescription('Submit a department package/setup')
      .addStringOption((o) => o.setName('name').setDescription('Department name').setRequired(true))
      .addStringOption((o) => o.setName('identifier').setDescription('Optional short code / package identifier').setRequired(false))
      .addUserOption((o) => o.setName('requester').setDescription('Optional purchaser/requester if not running this inside their ticket').setRequired(false))
      .addStringOption((o) => o.setName('notes').setDescription('Department package contents / implementation notes').setRequired(false)))
    .addSubcommand((sc) => sc.setName('gang').setDescription('Submit a gang / organization package')
      .addStringOption((o) => o.setName('name').setDescription('Gang / organization name').setRequired(true))
      .addStringOption((o) => o.setName('identifier').setDescription('Optional short code / package identifier').setRequired(false))
      .addUserOption((o) => o.setName('requester').setDescription('Optional purchaser/requester if not running this inside their ticket').setRequired(false))
      .addStringOption((o) => o.setName('notes').setDescription('Package contents / implementation notes').setRequired(false)))
    .addSubcommand((sc) => sc.setName('livery').setDescription('Submit a livery')
      .addStringOption((o) => o.setName('identifier').setDescription('Livery/file/vehicle identifier').setRequired(true))
      .addStringOption((o) => o.setName('name').setDescription('Livery display name').setRequired(false))
      .addStringOption((o) => o.setName('notes').setDescription('Livery notes / testing requirements').setRequired(false)))
    .addSubcommand((sc) => sc.setName('script').setDescription('Submit a script/resource')
      .addStringOption((o) => o.setName('resource').setDescription('Resource / script name').setRequired(true))
      .addStringOption((o) => o.setName('name').setDescription('Display name').setRequired(false))
      .addStringOption((o) => o.setName('notes').setDescription('Dependencies / testing requirements').setRequired(false)))
    .addSubcommand((sc) => sc.setName('other').setDescription('Submit another development item')
      .addStringOption((o) => o.setName('identifier').setDescription('Asset identifier / short name').setRequired(true))
      .addStringOption((o) => o.setName('name').setDescription('Display name').setRequired(false))
      .addStringOption((o) => o.setName('notes').setDescription('Developer notes / testing requirements').setRequired(false))),

  new SlashCommandBuilder()
    .setName('devtask')
    .setDescription('Create and manage internal development tasks')
    .addSubcommand((sc) => sc.setName('create').setDescription('Create a development task')
      .addStringOption((o) => o.setName('title').setDescription('Short task title').setRequired(true))
      .addStringOption((o) => o.setName('type').setDescription('Task type').setRequired(true).addChoices(
        { name: 'Bug', value: 'Bug' }, { name: 'Feature', value: 'Feature' }, { name: 'Vehicle', value: 'Vehicle' },
        { name: 'YMAP', value: 'YMAP' }, { name: 'Livery', value: 'Livery' }, { name: 'EUP', value: 'EUP' },
        { name: 'Department', value: 'Department' }, { name: 'Gang', value: 'Gang' },
        { name: 'Script', value: 'Script' }, { name: 'Other', value: 'Other' }))
      .addStringOption((o) => o.setName('description').setDescription('What needs to be done').setRequired(true))
      .addStringOption((o) => o.setName('priority').setDescription('Task priority').setRequired(false).addChoices(
        { name: 'Low', value: 'low' }, { name: 'Normal', value: 'normal' }, { name: 'High', value: 'high' }, { name: 'Urgent', value: 'urgent' }))
      .addUserOption((o) => o.setName('assignee').setDescription('Optional assigned developer').setRequired(false))
      .addStringOption((o) => o.setName('due_date').setDescription('Optional due date (YYYY-MM-DD)').setRequired(false)))
    .addSubcommand((sc) => sc.setName('view').setDescription('View a development task').addStringOption((o) => o.setName('id').setDescription('Task ID').setRequired(true)))
    .addSubcommand((sc) => sc.setName('assign').setDescription('Assign or hand over a development task')
      .addStringOption((o) => o.setName('id').setDescription('Task ID').setRequired(true))
      .addUserOption((o) => o.setName('user').setDescription('Developer taking the task').setRequired(true)))
    .addSubcommand((sc) => sc.setName('status').setDescription('Change a development task status')
      .addStringOption((o) => o.setName('id').setDescription('Task ID').setRequired(true))
      .addStringOption((o) => o.setName('status').setDescription('New status').setRequired(true).addChoices(
        { name: 'Backlog', value: 'backlog' }, { name: 'In Progress', value: 'in_progress' }, { name: 'Blocked', value: 'blocked' },
        { name: 'Ready for QA', value: 'qa' }, { name: 'Complete', value: 'complete' }))
      .addStringOption((o) => o.setName('reason').setDescription('Status note / blocker reason').setRequired(false)))
    .addSubcommand((sc) => sc.setName('note').setDescription('Add a permanent task note')
      .addStringOption((o) => o.setName('id').setDescription('Task ID').setRequired(true))
      .addStringOption((o) => o.setName('note').setDescription('Note').setRequired(true)))
    .addSubcommand((sc) => sc.setName('priority').setDescription('Change a development task priority')
      .addStringOption((o) => o.setName('id').setDescription('Task ID').setRequired(true))
      .addStringOption((o) => o.setName('priority').setDescription('New priority').setRequired(true).addChoices(
        { name: 'Low', value: 'low' }, { name: 'Normal', value: 'normal' }, { name: 'High', value: 'high' }, { name: 'Urgent', value: 'urgent' })))
    .addSubcommand((sc) => sc.setName('deadline').setDescription('Set or clear a development task due date')
      .addStringOption((o) => o.setName('id').setDescription('Task ID').setRequired(true))
      .addStringOption((o) => o.setName('due_date').setDescription('YYYY-MM-DD or CLEAR').setRequired(true)))
    .addSubcommand((sc) => sc.setName('list').setDescription('List development tasks')
      .addStringOption((o) => o.setName('status').setDescription('Optional status filter').setRequired(false).addChoices(
        { name: 'Backlog', value: 'backlog' }, { name: 'In Progress', value: 'in_progress' }, { name: 'Blocked', value: 'blocked' },
        { name: 'Ready for QA', value: 'qa' }, { name: 'Complete', value: 'complete' }))),

  new SlashCommandBuilder().setName('qa-queue').setDescription('List submissions currently waiting for Quality Assurance'),
  new SlashCommandBuilder().setName('qa-claim').setDescription('Claim a pending QA submission').addStringOption((o) => o.setName('id').setDescription('QA submission ID').setRequired(true)),
  new SlashCommandBuilder().setName('qa-unclaim').setDescription('Release your QA claim').addStringOption((o) => o.setName('id').setDescription('QA submission ID').setRequired(true)),
  new SlashCommandBuilder().setName('qa-retest').setDescription('Return a denied/changes-requested item to QA after fixes')
    .addStringOption((o) => o.setName('id').setDescription('QA submission ID').setRequired(true))
    .addStringOption((o) => o.setName('changes').setDescription('What was changed for the retest').setRequired(true)),

  new SlashCommandBuilder().setName('asset-info').setDescription('Look up an asset by spawn code/resource name').addStringOption((o) => o.setName('identifier').setDescription('Exact asset identifier').setRequired(true)),
  new SlashCommandBuilder().setName('asset-list').setDescription('List tracked development assets').addStringOption((o) => o.setName('type').setDescription('Optional asset type').setRequired(false).addChoices(
    { name: 'Vehicle', value: 'vehicle' }, { name: 'YMAP', value: 'ymap' }, { name: 'Livery', value: 'livery' },
    { name: 'EUP', value: 'eup' }, { name: 'Department', value: 'department' }, { name: 'Gang', value: 'gang' },
    { name: 'Script', value: 'script' }, { name: 'Other', value: 'other' })),

  new SlashCommandBuilder().setName('transfer-history').setDescription('View recent completed development transfer batches'),
  new SlashCommandBuilder().setName('release-notes').setDescription('Generate release notes for a completed transfer batch')
    .addStringOption((o) => o.setName('batch_id').setDescription('Batch ID; leave blank for the latest batch').setRequired(false)),
  new SlashCommandBuilder().setName('config-check').setDescription('Check roles, channels, and bot permissions for the development system'),

  new SlashCommandBuilder()
    .setName('mark-for-transfer')
    .setDescription('Mark a development item for the Saturday 4 PM Eastern transfer')
    .addStringOption((o) => o.setName('type').setDescription('Item type').setRequired(true).addChoices(
      { name: 'Vehicle', value: 'Vehicle' },
      { name: 'YMAP', value: 'YMAP' },
      { name: 'Livery', value: 'Livery' },
      { name: 'EUP', value: 'EUP' },
      { name: 'Department', value: 'Department' },
      { name: 'Gang', value: 'Gang' },
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
  new SlashCommandBuilder()
    .setName('vehicle-in-game')
    .setDescription('Legacy shortcut: mark a vehicle as live in game and notify the requester')
    .addStringOption((o) => o.setName('spawn_code').setDescription('Vehicle spawn code').setRequired(true))
    .addStringOption((o) => o.setName('notes').setDescription('Optional deployment notes').setRequired(false)),
  new SlashCommandBuilder()
    .setName('in-game')
    .setDescription('Mark an approved development asset as live in the server and notify the requester')
    .addStringOption((o) => o.setName('identifier').setDescription('Spawn code, resource, department/gang name, etc.').setRequired(true))
    .addStringOption((o) => o.setName('type').setDescription('Optional asset type when names overlap').setRequired(false).addChoices(
      { name: 'Vehicle', value: 'vehicle' }, { name: 'YMAP', value: 'ymap' }, { name: 'EUP', value: 'eup' },
      { name: 'Livery', value: 'livery' }, { name: 'Department', value: 'department' }, { name: 'Gang', value: 'gang' },
      { name: 'Script', value: 'script' }, { name: 'Other', value: 'other' }))
    .addStringOption((o) => o.setName('notes').setDescription('Optional deployment / live-server notes').setRequired(false)),

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
      qa_ticket_handler: 'qaTicketHandlerRoleIds', department_handler: 'departmentHandlerRoleIds', gang_handler: 'gangHandlerRoleIds', transfer: 'transferRoleIds',
    }[type];
    if (!key) return interaction.editReply('Unknown role configuration type.');
    const singularTicketHandlerTypes = new Set(['leo_handler', 'livery_handler', 'commission_handler', 'qa_ticket_handler', 'department_handler', 'gang_handler']);
    if (sub === 'add-role') {
      config[key] = singularTicketHandlerTypes.has(type) ? [role.id] : [...new Set([...config[key], role.id])];
    } else {
      config[key] = config[key].filter((id) => id !== role.id);
    }
    saveData();
    const label = roleTypeChoices.find((x) => x.value === type)?.name || type;
    await sendConfiguredLog(interaction.guild, 'config', {
      embeds: [auditEmbed('Development Configuration Changed', interaction.user, [
        { name: 'Setting', value: label, inline: true },
        { name: 'Action', value: sub === 'add-role' ? 'Role Added' : 'Role Removed', inline: true },
        { name: 'Role', value: `<@&${role.id}> (${role.id})`, inline: false },
      ])],
    });
    const singularNote = ['leo_handler', 'livery_handler', 'commission_handler', 'qa_ticket_handler', 'department_handler', 'gang_handler'].includes(type) && sub === 'add-role' ? ' Only this role will be pinged and granted handler access for that ticket type.' : '';
    return interaction.editReply(`${label}: ${config[key].length ? config[key].map((id) => `<@&${id}>`).join(', ') : 'None'}.${singularNote}`);
  }

  if (sub === 'set-category') {
    const type = interaction.options.getString('type', true);
    const category = interaction.options.getChannel('category', true);
    const key = { leo: 'leoCategoryId', livery: 'liveryCategoryId', commission: 'commissionCategoryId', qa: 'qaTicketCategoryId', department: 'departmentCategoryId', gang: 'gangCategoryId' }[type];
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
      role_sync_log: 'roleSyncLogChannelId', staff_log: 'staffLogChannelId', dev_log: 'devLogChannelId', log: 'logChannelId',
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
      { name: 'Department Ticket Handlers', value: showRoles(ticketHandlerRoleIds(config, 'department')) },
      { name: 'Gang Ticket Handlers', value: showRoles(ticketHandlerRoleIds(config, 'gang')) },
      { name: 'Transfer Managers', value: showRoles(config.transferRoleIds.length ? config.transferRoleIds : config.developerRoleIds) },
      { name: 'LEO Category', value: showChannel(config.leoCategoryId), inline: true },
      { name: 'Livery Category', value: showChannel(config.liveryCategoryId), inline: true },
      { name: 'Commission Category', value: showChannel(config.commissionCategoryId), inline: true },
      { name: 'QA Ticket Category', value: showChannel(config.qaTicketCategoryId), inline: true },
      { name: 'Department Category', value: showChannel(config.departmentCategoryId), inline: true },
      { name: 'Gang Category', value: showChannel(config.gangCategoryId), inline: true },
      { name: 'QA Submission Channel', value: showChannel(config.qaChannelId), inline: true },
      { name: 'Saturday Transfer Channel', value: showChannel(config.transferChannelId), inline: true },
      { name: 'Ticket / Transcript Logs', value: showChannel(config.ticketLogChannelId || config.logChannelId), inline: true },
      { name: 'QA Logs', value: showChannel(config.qaLogChannelId || config.logChannelId), inline: true },
      { name: 'Transfer Logs', value: showChannel(config.transferLogChannelId || config.logChannelId), inline: true },
      { name: 'Configuration Logs', value: showChannel(config.configLogChannelId || config.logChannelId), inline: true },
      { name: 'Role Sync Logs', value: showChannel(config.roleSyncLogChannelId || config.logChannelId), inline: true },
      { name: 'Staff Management Logs', value: showChannel(config.staffLogChannelId || config.logChannelId), inline: true },
      { name: 'Development Operations Logs', value: showChannel(config.devLogChannelId || config.configLogChannelId || config.logChannelId), inline: true },
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


      if (interaction.commandName === 'agreement') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isStaffManager(interaction.member)) return interaction.editReply('Development staff-management permission is required.');
        const sub = interaction.options.getSubcommand();
        if (sub === 'preview') {
          const config = guildConfig(interaction.guildId);
          return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('Current WCRP Privileged Access Agreement').setDescription(agreementTerms(config.agreementVersion)).setFooter({ text: 'Preview only — no signature is recorded from this message.' })] });
        }
        if (sub === 'send') {
          const target = interaction.options.getUser('user', true);
          const team = interaction.options.getString('team', true);
          if (target.bot) return interaction.editReply('Bots cannot sign staff access agreements.');
          try {
            const request = await sendAgreementRequest({ guild: interaction.guild, actor: interaction.user, target, team });
            return interaction.editReply(`Agreement **${request.version}** was DMed to <@${target.id}> for **${agreementTeamLabel(team)}**. They must type their name and exactly **I AGREE** before the signature is recorded.`);
          } catch (error) { return interaction.editReply(error.message); }
        }
        if (sub === 'status') {
          const target = interaction.options.getUser('user', true);
          return interaction.editReply({ embeds: [agreementStatusEmbed(interaction.guild, target, agreementProfile(interaction.guildId, target.id))] });
        }
        if (sub === 'list') {
          const rows = Object.entries(agreementGuild(interaction.guildId))
            .map(([userId, profile]) => ({ userId, current: profile.current }))
            .filter((x) => x.current)
            .sort((a, b) => (b.current.signedAt || b.current.at || 0) - (a.current.signedAt || a.current.at || 0))
            .slice(0, 25);
          const config = guildConfig(interaction.guildId);
          const lines = rows.map(({ userId, current }) => {
            const valid = current.status === 'signed' && current.version === config.agreementVersion;
            return `<@${userId}> — **${current.status}** — ${current.version || 'unknown'} — ${valid ? 'CURRENT' : 'not current'}`;
          });
          return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('Privileged Access Agreement Records').setDescription(lines.length ? lines.join('\n') : 'No agreement records have been created in this server.').setFooter({ text: `Current required version: ${config.agreementVersion}` }).setTimestamp()] });
        }
        if (sub === 'revoke') {
          const target = interaction.options.getUser('user', true);
          const reason = interaction.options.getString('reason', true);
          const profile = agreementProfile(interaction.guildId, target.id);
          if (!profile.current || profile.current.status !== 'signed') return interaction.editReply('That member does not currently have a signed agreement to revoke.');
          const previous = { ...profile.current };
          const revoked = { ...previous, status: 'revoked', revokedAt: Date.now(), revokedBy: interaction.user.id, revocationReason: reason };
          profile.current = revoked;
          profile.history.unshift({ ...revoked, at: revoked.revokedAt, event: 'revoked' });
          profile.history = profile.history.slice(0, 100);
          saveData();
          await logAgreementEvent(interaction.guild, 'Privileged Access Agreement Revoked', interaction.user, target.id, [
            { name: 'Version', value: previous.version || 'Unknown', inline: true },
            { name: 'Typed Name', value: truncate(previous.typedName || 'Not recorded', 200), inline: true },
            { name: 'Reason', value: truncate(reason), inline: false },
          ]);
          await target.send({ embeds: [new EmbedBuilder().setTitle('WCRP Access Agreement Revoked').setDescription(`Your privileged-access agreement acknowledgement for **${interaction.guild.name}** was revoked by management.`).addFields({ name: 'Reason', value: truncate(reason) }, { name: 'What This Means', value: 'This agreement record is no longer valid for privileged Development/QA access. Contact management if you believe this is an error.' }).setTimestamp()] }).catch(() => null);
          return interaction.editReply(`Revoked <@${target.id}>'s current privileged-access agreement. Use the normal suspend/remove/blacklist staff action if their server roles also need to be removed.`);
        }
      }

      if (interaction.commandName === 'staff-config') return handleStaffConfig(interaction);

      if (interaction.commandName === 'staff-panel') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isStaffManager(interaction.member)) return interaction.editReply('Development staff-management permission is required.');
        const msg = await interaction.channel.send(staffManagementPanel());
        await sendConfiguredLog(interaction.guild, 'staff', { embeds: [auditEmbed('Staff Management Panel Posted', interaction.user, [{ name: 'Channel', value: `<#${interaction.channelId}>`, inline: true }, { name: 'Message', value: `[Open Panel](${msg.url})`, inline: true }])] });
        return interaction.editReply('Staff management panel posted.');
      }

      if (['hire', 'promote', 'demote', 'suspend', 'unsuspend', 'remove-staff', 'blacklist-staff', 'unblacklist-staff'].includes(interaction.commandName)) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isStaffManager(interaction.member)) return interaction.editReply('Development staff-management permission is required.');
        const actionMap = { 'remove-staff': 'remove', 'blacklist-staff': 'blacklist', 'unblacklist-staff': 'unblacklist' };
        const action = actionMap[interaction.commandName] || interaction.commandName;
        const user = interaction.options.getUser('user', true);
        const team = interaction.options.getString('team', true);
        const rank = interaction.options.getRole('rank');
        const reason = interaction.options.getString('reason', true);
        try {
          const result = await performStaffAction({ guild: interaction.guild, actor: interaction.user, targetUserId: user.id, team, action, rankRoleId: rank?.id || null, reason });
          const rankText = result.teamRecord.rankRoleId ? ` with rank <@&${result.teamRecord.rankRoleId}>` : '';
          const dmText = result.dmDelivered ? ' DM delivered.' : ' I could not DM them (their DMs may be disabled).';
          return interaction.editReply(`${staffActionTitle(action)}: <@${user.id}> - ${teamLabel(team)}${rankText}.${dmText}`);
        } catch (error) { return interaction.editReply(error.message); }
      }

      if (interaction.commandName === 'staff-profile') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isStaffManager(interaction.member)) return interaction.editReply('Development staff-management permission is required.');
        const user = interaction.options.getUser('user', true);
        return interaction.editReply({ embeds: [staffProfileEmbed(interaction.guild, user, staffRecord(interaction.guildId, user.id))] });
      }

      if (interaction.commandName === 'staff-roster') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isStaffManager(interaction.member) && !isDeveloper(interaction.member) && !isQA(interaction.member))) return interaction.editReply('Development/QA permission is required.');
        const team = interaction.options.getString('team', true);
        const guildStaff = staffGuild(interaction.guildId);
        const rows = Object.entries(guildStaff).filter(([, rec]) => rec?.[team]?.status && rec[team].status !== 'none').map(([userId, rec]) => ({ userId, ...rec[team] }));
        rows.sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1));
        const lines = rows.map((r) => `<@${r.userId}> - **${r.status}**${r.rankRoleId ? ` - <@&${r.rankRoleId}>` : ''}`);
        const embed = new EmbedBuilder().setTitle(`${teamLabel(team)} Roster`).setDescription(lines.length ? lines.join('\n').slice(0, 4000) : 'No staff records found.').setFooter({ text: `${rows.length} recorded member(s)` }).setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      if (interaction.commandName === 'staff-note') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isStaffManager(interaction.member)) return interaction.editReply('Development staff-management permission is required.');
        const user = interaction.options.getUser('user', true);
        const note = interaction.options.getString('note', true);
        const record = staffRecord(interaction.guildId, user.id);
        record.notes.unshift({ authorId: interaction.user.id, text: note, at: Date.now() });
        record.notes = record.notes.slice(0, 50);
        pushStaffHistory(record, 'note', null, interaction.user, note);
        saveData();
        await logStaffAction(interaction.guild, 'Staff Management Note Added', interaction.user, user.id, null, note);
        return interaction.editReply(`Added a permanent management note to <@${user.id}>.`);
      }

      if (interaction.commandName === 'staff-history') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isStaffManager(interaction.member)) return interaction.editReply('Development staff-management permission is required.');
        const user = interaction.options.getUser('user', true);
        const record = staffRecord(interaction.guildId, user.id);
        const lines = record.history.slice(0, 15).map((h) => `<t:${Math.floor(h.at / 1000)}:f> - **${h.action}**${h.team ? ` (${teamLabel(h.team)})` : ''} by <@${h.actorId}>\n${truncate(h.reason, 250)}`);
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`Staff History - ${user.username}`).setDescription(lines.length ? lines.join('\n\n').slice(0, 4000) : 'No staff-management history recorded.')] });
      }

      if (interaction.commandName === 'ticket-claim' || interaction.commandName === 'ticket-unclaim') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild()) return interaction.editReply('This command can only be used in a server.');
        const ticket = data.tickets[interaction.channelId];
        if (!ticket) return interaction.editReply('This is not a registered development ticket.');
        const handlerIds = ticketHandlerRoleIds(guildConfig(interaction.guildId), ticket.type);
        if (!isAdmin(interaction.member) && !hasAnyRole(interaction.member, handlerIds)) return interaction.editReply('Only the configured ticket handler team can claim this ticket.');
        if (interaction.commandName === 'ticket-claim') {
          if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id) return interaction.editReply(`This ticket is already claimed by <@${ticket.claimedBy}>.`);
          ticket.claimedBy = interaction.user.id; ticket.claimedAt = Date.now(); saveData();
          await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle('Ticket Claimed').setDescription(`<@${interaction.user.id}> is now handling this ticket.`).setTimestamp()] });
          await sendConfiguredLog(interaction.guild, 'ticket', { embeds: [auditEmbed('Development Ticket Claimed', interaction.user, [{ name: 'Ticket', value: `<#${interaction.channelId}>`, inline: true }])] });
          return interaction.editReply('Ticket claimed.');
        }
        if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id && !isAdmin(interaction.member)) return interaction.editReply(`Only <@${ticket.claimedBy}> or an administrator can unclaim this ticket.`);
        ticket.claimedBy = null; ticket.claimedAt = null; saveData();
        await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle('Ticket Unclaimed').setDescription(`The handler claim was removed by <@${interaction.user.id}>.`).setTimestamp()] });
        await sendConfiguredLog(interaction.guild, 'ticket', { embeds: [auditEmbed('Development Ticket Unclaimed', interaction.user, [{ name: 'Ticket', value: `<#${interaction.channelId}>`, inline: true }])] });
        return interaction.editReply('Ticket unclaimed.');
      }

      if (interaction.commandName === 'qa-stats') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isQA(interaction.member) && !isDeveloper(interaction.member) && !isStaffManager(interaction.member))) return interaction.editReply('Development/QA permission is required.');
        const reviewer = interaction.options.getUser('reviewer');
        const items = Object.values(data.qaSubmissions).filter((x) => x.guildId === interaction.guildId && (!reviewer || x.reviewedBy === reviewer.id));
        const approved = items.filter((x) => x.status === 'Approved').length;
        const denied = items.filter((x) => x.status === 'Denied').length;
        const pending = items.filter((x) => x.status === 'Pending QA').length;
        const changes = items.filter((x) => x.status === 'Changes Requested').length;
        const claimed = items.filter((x) => x.status === 'Pending QA' && x.claimedBy).length;
        const embed = new EmbedBuilder().setTitle(reviewer ? `QA Statistics - ${reviewer.username}` : 'Quality Assurance Statistics').addFields(
          { name: 'Total Submissions', value: String(items.length), inline: true },
          { name: 'Approved', value: String(approved), inline: true },
          { name: 'Denied', value: String(denied), inline: true },
          { name: 'Changes Requested', value: String(changes), inline: true },
          { name: 'Pending QA', value: String(pending), inline: true },
          { name: 'Currently Claimed', value: String(claimed), inline: true },
        ).setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      if (interaction.commandName === 'dev-overview') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isDeveloper(interaction.member) && !isQA(interaction.member) && !isStaffManager(interaction.member) && !isTransferManager(interaction.member))) return interaction.editReply('Development Utilities permission is required.');
        const openTickets = Object.values(data.tickets).filter((x) => x.guildId === interaction.guildId && x.status !== 'closed').length;
        const pendingQa = Object.values(data.qaSubmissions).filter((x) => x.guildId === interaction.guildId && x.status === 'Pending QA').length;
        const pendingTransfers = data.transfers.filter((x) => x.guildId === interaction.guildId && x.status === 'pending').length;
        const openTasks = Object.values(data.tasks).filter((x) => x.guildId === interaction.guildId && x.status !== 'complete').length;
        const blockedTasks = Object.values(data.tasks).filter((x) => x.guildId === interaction.guildId && x.status === 'blocked').length;
        const approvedAssets = Object.values(data.assets).filter((x) => x.guildId === interaction.guildId && x.qaStatus === 'Approved').length;
        const staff = Object.values(staffGuild(interaction.guildId));
        const devActive = staff.filter((x) => x.developer?.status === 'active').length;
        const qaActive = staff.filter((x) => x.qa?.status === 'active').length;
        const embed = new EmbedBuilder().setTitle('WCRP Development Operations Overview').addFields(
          { name: 'Open Development Tickets', value: String(openTickets), inline: true },
          { name: 'Pending QA', value: String(pendingQa), inline: true },
          { name: 'Pending Transfers', value: String(pendingTransfers), inline: true },
          { name: 'Open Development Tasks', value: String(openTasks), inline: true },
          { name: 'Blocked Tasks', value: String(blockedTasks), inline: true },
          { name: 'Approved Assets', value: String(approvedAssets), inline: true },
          { name: 'Active Developers', value: String(devActive), inline: true },
          { name: 'Active QA Members', value: String(qaActive), inline: true },
          { name: 'Next Transfer Window', value: 'Saturday at 4:00 PM Eastern', inline: true },
        ).setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      if (interaction.commandName === 'devtask') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isDeveloper(interaction.member) && !isStaffManager(interaction.member))) return interaction.editReply('Developer or development management permission is required.');
        const sub = interaction.options.getSubcommand();
        if (sub === 'create') {
          const dueRaw = interaction.options.getString('due_date');
          const dueAt = parseDueDate(dueRaw);
          if (dueRaw && !dueAt) return interaction.editReply('Invalid due date. Use YYYY-MM-DD.');
          const assignee = interaction.options.getUser('assignee');
          if (assignee) {
            const assigneeMember = await fetchMember(interaction.guild, assignee.id);
            if (!assigneeMember || !isDeveloper(assigneeMember)) return interaction.editReply('The assignee must have configured Developer access in this server.');
          }
          const task = {
            id: shortId('task_'), guildId: interaction.guildId, title: interaction.options.getString('title', true),
            type: interaction.options.getString('type', true), description: interaction.options.getString('description', true),
            priority: interaction.options.getString('priority') || 'normal', status: 'backlog', assigneeId: assignee?.id || null,
            dueAt, createdBy: interaction.user.id, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null,
            notes: [], history: [], blockReason: null,
          };
          pushTaskHistory(task, 'created', interaction.user, { assigneeId: task.assigneeId });
          data.tasks[task.id] = task; saveData();
          await logTaskAction(interaction.guild, 'Development Task Created', interaction.user, task);
          return interaction.editReply({ content: `Created task \`${task.id}\`.`, embeds: [taskEmbed(task)] });
        }
        if (sub === 'view') {
          const task = getTask(interaction.guildId, interaction.options.getString('id', true));
          return task ? interaction.editReply({ embeds: [taskEmbed(task)] }) : interaction.editReply('Task not found.');
        }
        if (sub === 'list') {
          const filter = interaction.options.getString('status');
          const tasks = Object.values(data.tasks).filter((t) => t.guildId === interaction.guildId && (!filter || t.status === filter)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30);
          const lines = tasks.map((t) => `\`${t.id}\` - **${t.title}** - ${taskStatusLabel(t.status)} - ${taskPriorityLabel(t.priority)}${t.assigneeId ? ` - <@${t.assigneeId}>` : ''}`);
          return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(filter ? `${taskStatusLabel(filter)} Development Tasks` : 'Development Tasks').setDescription(lines.length ? lines.join('\n').slice(0, 4000) : 'No matching development tasks.').setTimestamp()] });
        }
        const task = getTask(interaction.guildId, interaction.options.getString('id', true));
        if (!task) return interaction.editReply('Task not found.');
        if (sub === 'assign') {
          const user = interaction.options.getUser('user', true);
          const assigneeMember = await fetchMember(interaction.guild, user.id);
          if (!assigneeMember || !isDeveloper(assigneeMember)) return interaction.editReply('The assignee must have configured Developer access in this server.');
          const previous = task.assigneeId;
          task.assigneeId = user.id; task.status = task.status === 'backlog' ? 'in_progress' : task.status;
          pushTaskHistory(task, previous ? 'handed_over' : 'assigned', interaction.user, { previousAssigneeId: previous, assigneeId: user.id }); saveData();
          await logTaskAction(interaction.guild, previous ? 'Development Task Handed Over' : 'Development Task Assigned', interaction.user, task, previous ? [{ name: 'Previous Assignee', value: `<@${previous}>`, inline: true }] : []);
          return interaction.editReply(`Task \`${task.id}\` assigned to <@${user.id}>.`);
        }
        if (sub === 'status') {
          const status = interaction.options.getString('status', true);
          const reason = interaction.options.getString('reason');
          task.status = status;
          task.blockReason = status === 'blocked' ? (reason || 'No blocker reason provided.') : null;
          task.completedAt = status === 'complete' ? Date.now() : null;
          pushTaskHistory(task, 'status_changed', interaction.user, { status, reason: reason || null }); saveData();
          await logTaskAction(interaction.guild, 'Development Task Status Changed', interaction.user, task, reason ? [{ name: 'Reason', value: truncate(reason), inline: false }] : []);
          return interaction.editReply(`Task \`${task.id}\` is now **${taskStatusLabel(status)}**.`);
        }
        if (sub === 'note') {
          const note = interaction.options.getString('note', true);
          task.notes.unshift({ authorId: interaction.user.id, text: note, at: Date.now() }); task.notes = task.notes.slice(0, 50);
          pushTaskHistory(task, 'note_added', interaction.user, { note }); saveData();
          await logTaskAction(interaction.guild, 'Development Task Note Added', interaction.user, task, [{ name: 'Note', value: truncate(note), inline: false }]);
          return interaction.editReply(`Added a permanent note to task \`${task.id}\`.`);
        }
        if (sub === 'priority') {
          const priority = interaction.options.getString('priority', true);
          task.priority = priority; pushTaskHistory(task, 'priority_changed', interaction.user, { priority }); saveData();
          await logTaskAction(interaction.guild, 'Development Task Priority Changed', interaction.user, task);
          return interaction.editReply(`Task \`${task.id}\` priority is now **${taskPriorityLabel(priority)}**.`);
        }
        if (sub === 'deadline') {
          const raw = interaction.options.getString('due_date', true).trim();
          if (raw.toUpperCase() === 'CLEAR') task.dueAt = null;
          else {
            const dueAt = parseDueDate(raw);
            if (!dueAt) return interaction.editReply('Invalid due date. Use YYYY-MM-DD or CLEAR.');
            task.dueAt = dueAt;
          }
          pushTaskHistory(task, 'deadline_changed', interaction.user, { dueAt: task.dueAt }); saveData();
          await logTaskAction(interaction.guild, 'Development Task Deadline Changed', interaction.user, task);
          return interaction.editReply(task.dueAt ? `Task \`${task.id}\` is due <t:${Math.floor(task.dueAt / 1000)}:D>.` : `Cleared the deadline for task \`${task.id}\`.`);
        }
      }

      if (interaction.commandName === 'qa-queue') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isQA(interaction.member) && !isDeveloper(interaction.member) && !isStaffManager(interaction.member))) return interaction.editReply('Development/QA permission is required.');
        const items = Object.values(data.qaSubmissions).filter((x) => x.guildId === interaction.guildId && x.status === 'Pending QA').sort((a, b) => a.createdAt - b.createdAt).slice(0, 30);
        const lines = items.map((x) => `\`${x.id}\` - **${assetKindLabel(x.kind)}** - ${x.identifier} - ${x.claimedBy ? `claimed by <@${x.claimedBy}>` : 'unclaimed'} - <t:${Math.floor(x.createdAt / 1000)}:R>`);
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('Quality Assurance Queue').setDescription(lines.length ? lines.join('\n').slice(0, 4000) : 'No submissions are waiting for QA.').setTimestamp()] });
      }

      if (interaction.commandName === 'qa-claim' || interaction.commandName === 'qa-unclaim') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isQA(interaction.member)) return interaction.editReply('Quality Assurance permission is required.');
        const submission = data.qaSubmissions[interaction.options.getString('id', true)];
        if (!submission || submission.guildId !== interaction.guildId) return interaction.editReply('QA submission not found.');
        if (submission.status !== 'Pending QA') return interaction.editReply(`This submission is ${submission.status}.`);
        if (interaction.commandName === 'qa-claim') {
          if (submission.claimedBy && submission.claimedBy !== interaction.user.id && !isAdmin(interaction.member)) return interaction.editReply(`Already claimed by <@${submission.claimedBy}>.`);
          submission.claimedBy = interaction.user.id; submission.claimedAt = Date.now(); saveData();
          const ch = await interaction.guild.channels.fetch(submission.channelId).catch(() => null);
          const msg = ch?.isTextBased() ? await ch.messages.fetch(submission.messageId).catch(() => null) : null;
          if (msg) await msg.edit({ embeds: [qaStatusEmbed(submission)], components: [qaReviewButtons(submission.id)] }).catch(() => null);
          await sendConfiguredLog(interaction.guild, 'qa', { embeds: [auditEmbed('QA Submission Claimed', interaction.user, [{ name: 'Submission', value: `\`${submission.id}\``, inline: true }, { name: 'Identifier', value: submission.identifier, inline: true }])] });
          return interaction.editReply(`Claimed QA submission \`${submission.id}\`.`);
        }
        if (submission.claimedBy && submission.claimedBy !== interaction.user.id && !isAdmin(interaction.member)) return interaction.editReply(`Only <@${submission.claimedBy}> or an administrator can release this claim.`);
        submission.claimedBy = null; submission.claimedAt = null; saveData();
        const ch = await interaction.guild.channels.fetch(submission.channelId).catch(() => null);
        const msg = ch?.isTextBased() ? await ch.messages.fetch(submission.messageId).catch(() => null) : null;
        if (msg) await msg.edit({ embeds: [qaStatusEmbed(submission)], components: [qaReviewButtons(submission.id)] }).catch(() => null);
        await sendConfiguredLog(interaction.guild, 'qa', { embeds: [auditEmbed('QA Submission Unclaimed', interaction.user, [{ name: 'Submission', value: `\`${submission.id}\``, inline: true }])] });
        return interaction.editReply(`Released QA submission \`${submission.id}\`.`);
      }

      if (interaction.commandName === 'qa-retest') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isDeveloper(interaction.member)) return interaction.editReply('Developer permission is required.');
        const submission = data.qaSubmissions[interaction.options.getString('id', true)];
        if (!submission || submission.guildId !== interaction.guildId) return interaction.editReply('QA submission not found.');
        if (!['Denied', 'Changes Requested'].includes(submission.status)) return interaction.editReply('Only denied or changes-requested submissions can be sent for a retest.');
        if (submission.submitterId !== interaction.user.id && !isAdmin(interaction.member)) return interaction.editReply('Only the original submitter or an administrator can request this retest.');
        const changes = interaction.options.getString('changes', true);
        submission.status = 'Pending QA'; submission.reviewedBy = null; submission.reviewReason = null; submission.reviewedAt = null;
        submission.claimedBy = null; submission.claimedAt = null; submission.retestCount = Number(submission.retestCount || 0) + 1;
        submission.notes = `${submission.notes ? `${submission.notes}\n\n` : ''}Retest ${submission.retestCount}: ${changes}`;
        const asset = data.assets[assetKey(submission.guildId, submission.kind, submission.identifier)];
        if (asset) {
          asset.qaStatus = 'Pending QA'; asset.updatedAt = Date.now();
          asset.history.unshift({ at: Date.now(), event: `QA Retest ${submission.retestCount} Requested`, actorId: interaction.user.id, qaSubmissionId: submission.id, reason: changes });
        }
        saveData();
        const qaChannel = await interaction.guild.channels.fetch(submission.channelId).catch(() => null);
        const qaMessage = qaChannel?.isTextBased() ? await qaChannel.messages.fetch(submission.messageId).catch(() => null) : null;
        if (qaMessage) await qaMessage.edit({ embeds: [qaStatusEmbed(submission)], components: [qaReviewButtons(submission.id)] }).catch(() => null);
        const cfg = guildConfig(interaction.guildId); const pingIds = cfg.qaNotificationRoleId && interaction.guild.roles.cache.has(cfg.qaNotificationRoleId) ? [cfg.qaNotificationRoleId] : [];
        if (qaChannel?.isTextBased()) await qaChannel.send({ content: `${roleMentions(pingIds)} Retest requested for \`${submission.id}\` - **${submission.identifier}**.\nChanges: ${truncate(changes, 1200)}`, allowedMentions: { roles: pingIds } }).catch(() => null);
        await sendConfiguredLog(interaction.guild, 'qa', { embeds: [auditEmbed('QA Retest Requested', interaction.user, [{ name: 'Submission', value: `\`${submission.id}\``, inline: true }, { name: 'Changes', value: truncate(changes), inline: false }])] });
        return interaction.editReply(`QA submission \`${submission.id}\` returned to the QA queue for retest.`);
      }

      if (interaction.commandName === 'asset-info') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isDeveloper(interaction.member) && !isQA(interaction.member) && !isStaffManager(interaction.member) && !isTransferManager(interaction.member))) return interaction.editReply('Development Utilities permission is required.');
        const matches = findAssets(interaction.guildId, interaction.options.getString('identifier', true));
        if (!matches.length) return interaction.editReply('No asset record was found with that exact identifier/name.');
        if (matches.length === 1) return interaction.editReply({ embeds: [assetEmbed(matches[0])] });
        return interaction.editReply(matches.map((a) => `${a.kind.toUpperCase()} - \`${a.identifier}\` - ${a.qaStatus}`).join('\n').slice(0, 1900));
      }

      if (interaction.commandName === 'asset-list') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isDeveloper(interaction.member) && !isQA(interaction.member) && !isStaffManager(interaction.member) && !isTransferManager(interaction.member))) return interaction.editReply('Development Utilities permission is required.');
        const type = interaction.options.getString('type');
        const assets = Object.values(data.assets).filter((a) => a.guildId === interaction.guildId && (!type || a.kind === type)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
        const lines = assets.map((a) => `**${a.kind.toUpperCase()}** - \`${a.identifier}\` - ${a.qaStatus || 'Unknown'} - transfer: ${a.transferStatus || 'not_marked'}`);
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle(type ? `${type.toUpperCase()} Asset Registry` : 'Development Asset Registry').setDescription(lines.length ? lines.join('\n').slice(0, 4000) : 'No tracked assets found.').setTimestamp()] });
      }

      if (interaction.commandName === 'transfer-history') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isDeveloper(interaction.member) && !isQA(interaction.member) && !isTransferManager(interaction.member))) return interaction.editReply('Development/QA/Transfer permission is required.');
        const batches = Object.values(data.transferBatches).filter((b) => b.guildId === interaction.guildId).sort((a, b) => b.completedAt - a.completedAt).slice(0, 15);
        const lines = batches.map((b) => `\`${b.id}\` - <t:${Math.floor(b.completedAt / 1000)}:D> - ${b.itemIds.length} item(s) - <@${b.completedBy}>`);
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('Development Transfer History').setDescription(lines.length ? lines.join('\n') : 'No completed transfer batches have been recorded yet.').setTimestamp()] });
      }

      if (interaction.commandName === 'release-notes') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isDeveloper(interaction.member) && !isTransferManager(interaction.member) && !isStaffManager(interaction.member))) return interaction.editReply('Developer/Transfer Manager permission is required.');
        const id = interaction.options.getString('batch_id');
        const batch = id ? data.transferBatches[id] : latestTransferBatch(interaction.guildId);
        if (!batch || batch.guildId !== interaction.guildId) return interaction.editReply('Transfer batch not found.');
        const items = batch.itemIds.map((itemId) => data.transfers.find((x) => x.id === itemId)).filter(Boolean);
        return interaction.editReply({ embeds: [releaseNotesEmbed(batch, items)] });
      }

      if (interaction.commandName === 'config-check') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || (!isAdmin(interaction.member) && !isStaffManager(interaction.member))) return interaction.editReply('Administrator or development management permission is required.');
        return interaction.editReply({ embeds: [await configHealthEmbed(interaction.guild)] });
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

      if (interaction.commandName === 'approve') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isDeveloper(interaction.member)) return interaction.editReply('Only the configured Developer team can submit development assets for QA.');
        const sub = interaction.options.getSubcommand();

        if (sub === 'vehicle') {
          const spawnCode = interaction.options.getString('spawn_code', true).trim();
          const started = startVehicleQASubmission(
            interaction,
            spawnCode,
            interaction.options.getString('name'),
            interaction.options.getString('other_flags'),
            interaction.options.getString('notes'),
          );
          if (started.error) return interaction.editReply(started.error);
          return interaction.editReply({ content: 'Select every vehicle flag that applies. The submission will then be sent to Quality Assurance.', components: [vehicleFlagMenu(started.key)] });
        }

        let kind = sub;
        let identifier;
        let displayName = interaction.options.getString('name');
        let location = interaction.options.getString('location');
        let notes = interaction.options.getString('notes');
        if (sub === 'ymap' || sub === 'eup' || sub === 'script') identifier = interaction.options.getString('resource', true).trim();
        else if (sub === 'department' || sub === 'gang') {
          displayName = interaction.options.getString('name', true).trim();
          identifier = interaction.options.getString('identifier')?.trim() || displayName;
        } else identifier = interaction.options.getString('identifier', true).trim();

        const requester = (sub === 'department' || sub === 'gang') ? interaction.options.getUser('requester') : null;
        try {
          const { message } = await submitGenericQASubmission(interaction, { kind, identifier, displayName, location, notes, requesterId: requester?.id || null });
          return interaction.editReply(`${assetKindLabel(kind)} submitted to Quality Assurance: ${message.url}`);
        } catch (error) {
          return interaction.editReply(error.message);
        }
      }

      if (interaction.commandName === 'approve-vehicle') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (!interaction.inGuild() || !isDeveloper(interaction.member)) return interaction.editReply('Only the configured Developer team can submit vehicles for QA.');
        const spawnCode = interaction.options.getString('spawn_code', true).trim();
        const existingAsset = findAssets(interaction.guildId, spawnCode, 'vehicle')[0];
        const existingPending = Object.values(data.qaSubmissions).find((x) => x.guildId === interaction.guildId && x.kind === 'vehicle' && String(x.identifier).toLowerCase() === spawnCode.toLowerCase() && x.status === 'Pending QA');
        if (existingPending) return interaction.editReply(`A QA submission for spawn code **${spawnCode}** is already pending as \`${existingPending.id}\`.`);
        if (existingAsset && ['Approved'].includes(existingAsset.qaStatus)) return interaction.editReply(`Spawn code **${spawnCode}** is already in the asset registry as approved. Use /asset-info to review it before submitting a replacement.`);
        const key = shortId('vf_');
        const sourceTicket = data.tickets[interaction.channelId];
        pendingVehicle.set(key, {
          guildId: interaction.guildId,
          submitterId: interaction.user.id,
          requesterId: sourceTicket?.openerId || interaction.user.id,
          sourceChannelId: interaction.channelId,
          sourceTicketChannelId: sourceTicket?.channelId || null,
          spawnCode,
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
        const resourceName = interaction.options.getString('resource', true).trim();
        const existingPending = Object.values(data.qaSubmissions).find((x) => x.guildId === interaction.guildId && x.kind === 'ymap' && String(x.identifier).toLowerCase() === resourceName.toLowerCase() && x.status === 'Pending QA');
        if (existingPending) return interaction.editReply(`A QA submission for **${resourceName}** is already pending as \`${existingPending.id}\`.`);
        const sourceTicket = data.tickets[interaction.channelId];
        const submission = {
          id: shortId('qa_'), guildId: interaction.guildId, kind: 'ymap', submitterId: interaction.user.id,
          requesterId: sourceTicket?.openerId || interaction.user.id,
          sourceChannelId: interaction.channelId,
          sourceTicketChannelId: sourceTicket?.channelId || null,
          identifier: resourceName, displayName: interaction.options.getString('map_name'),
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
        data.transfers.push(item);
        if (item.identifier) {
          const matches = findAssets(interaction.guildId, item.identifier);
          for (const asset of matches) {
            asset.transferId = item.id; asset.transferStatus = 'pending'; asset.updatedAt = Date.now();
            asset.history.unshift({ at: Date.now(), event: 'Marked for Transfer', actorId: interaction.user.id, transferId: item.id });
          }
        }
        saveData();
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

      if (interaction.commandName === 'vehicle-in-game') {
        return handleAssetInGame(
          interaction,
          interaction.options.getString('spawn_code', true).trim(),
          'vehicle',
          interaction.options.getString('notes'),
        );
      }

      if (interaction.commandName === 'in-game') {
        return handleAssetInGame(
          interaction,
          interaction.options.getString('identifier', true).trim(),
          interaction.options.getString('type'),
          interaction.options.getString('notes'),
        );
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
        const completedAt = Date.now();
        for (const item of data.transfers) {
          if (item.guildId !== interaction.guildId || item.status !== 'pending') continue;
          if (id.toUpperCase() !== 'ALL' && item.id !== id) continue;
          item.status = 'completed'; item.completedAt = completedAt; item.completedBy = interaction.user.id; completed.push(item);
          if (item.identifier) {
            for (const asset of findAssets(interaction.guildId, item.identifier)) {
              asset.transferId = item.id;
              asset.transferStatus = 'completed';
              asset.transferredAt = completedAt;
              asset.updatedAt = completedAt;
              asset.history.unshift({ at: completedAt, event: 'Transfer Completed', actorId: interaction.user.id, transferId: item.id });
            }
          }
        }
        let batch = null;
        if (completed.length) {
          batch = { id: shortId('batch_'), guildId: interaction.guildId, itemIds: completed.map((x) => x.id), completedAt, completedBy: interaction.user.id };
          data.transferBatches[batch.id] = batch;
        }
        saveData();
        if (completed.length) {
          await sendConfiguredLog(interaction.guild, 'transfer', {
            embeds: [auditEmbed('Transfer Batch Completed', interaction.user, [
              { name: 'Batch ID', value: `\`${batch.id}\``, inline: true },
              { name: 'Completed', value: completed.map((item) => `\`${item.id}\` - ${item.type} - ${item.name}`).join('\n').slice(0, 1024) },
            ])],
          });
        }
        return interaction.editReply(completed.length ? `Marked ${completed.length} transfer item(s) complete in batch \`${batch.id}\`. Use /release-notes to generate the release summary.` : 'No matching pending transfer item was found.');
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
      if (interaction.customId.startsWith('agreement_sign:')) {
        const requestId = interaction.customId.split(':')[1];
        const request = data.agreementRequests[requestId];
        if (!request) return interaction.reply({ content: 'This agreement request no longer exists.' });
        if (interaction.user.id !== request.userId) return interaction.reply({ content: 'Only the person this agreement was sent to can sign it.' });
        if (request.status !== 'pending') return interaction.reply({ content: `This agreement request is no longer pending (status: ${request.status}).` });
        return interaction.showModal(agreementSignModal(requestId));
      }
      if (interaction.customId.startsWith('agreement_decline:')) {
        const requestId = interaction.customId.split(':')[1];
        const request = data.agreementRequests[requestId];
        if (!request) return interaction.reply({ content: 'This agreement request no longer exists.' });
        return declineAgreement(interaction, request);
      }
      if (interaction.customId.startsWith('staff_action:')) {
        if (!interaction.inGuild() || !isStaffManager(interaction.member)) return interaction.reply({ content: 'Development staff-management permission is required.', flags: MessageFlags.Ephemeral });
        const action = interaction.customId.split(':')[1];
        const key = newStaffFlow(interaction, action);
        return interaction.reply({ content: `Select the team for **${staffActionTitle(action)}**.`, components: [staffTeamMenu(key)], flags: MessageFlags.Ephemeral });
      }
      if (interaction.customId.startsWith('open_ticket:')) {
        const type = interaction.customId.split(':')[1];
        const modal = ticketModal(type);
        if (!modal) return interaction.reply({ content: 'Unknown ticket type.', flags: MessageFlags.Ephemeral });
        return interaction.showModal(modal);
      }
      if (interaction.customId.startsWith('ticket_status:')) {
        const channelId = interaction.customId.split(':')[1];
        const ticket = data.tickets[channelId];
        if (!ticket || ticket.guildId !== interaction.guildId) return interaction.reply({ content: 'Ticket record not found.', flags: MessageFlags.Ephemeral });
        const handlerIds = ticketHandlerRoleIds(guildConfig(interaction.guildId), ticket.type);
        if (!isAdmin(interaction.member) && !hasAnyRole(interaction.member, handlerIds)) return interaction.reply({ content: 'Only the configured handler role can update this ticket status.', flags: MessageFlags.Ephemeral });
        if (ticket.status === 'closed') return interaction.reply({ content: 'This ticket is already closed.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ content: `Current status: **${ticketStatusLabel(ticket.status)}**. Select the new status.`, components: [ticketStatusMenu(channelId)], flags: MessageFlags.Ephemeral });
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

    if (interaction.isUserSelectMenu() && interaction.customId.startsWith('staff_user:')) {
      const key = interaction.customId.split(':')[1];
      const flow = pendingStaffFlow.get(key);
      if (!flow || flow.guildId !== interaction.guildId || flow.actorId !== interaction.user.id) return interaction.reply({ content: 'This staff-management flow expired. Start again from the panel.', flags: MessageFlags.Ephemeral });
      if (!isStaffManager(interaction.member)) return interaction.reply({ content: 'Development staff-management permission is required.', flags: MessageFlags.Ephemeral });
      flow.userId = interaction.values[0];
      if (['hire', 'promote', 'demote'].includes(flow.action)) {
        const ranks = teamRanks(guildConfig(interaction.guildId), flow.team);
        if (!ranks.length) return interaction.update({ content: `No ${teamLabel(flow.team)} rank roles are configured. Use /staff-config add-rank first.`, components: [] });
        return interaction.update({ content: `Select the new ${teamLabel(flow.team)} rank for <@${flow.userId}>.`, components: [staffRankMenu(key, guildConfig(interaction.guildId), flow.team)] });
      }
      return interaction.showModal(staffReasonModal(key, flow.action));
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('staff_team:')) {
      const key = interaction.customId.split(':')[1];
      const flow = pendingStaffFlow.get(key);
      if (!flow || flow.guildId !== interaction.guildId || flow.actorId !== interaction.user.id) return interaction.reply({ content: 'This staff-management flow expired. Start again from the panel.', flags: MessageFlags.Ephemeral });
      if (!isStaffManager(interaction.member)) return interaction.reply({ content: 'Development staff-management permission is required.', flags: MessageFlags.Ephemeral });
      flow.team = interaction.values[0];
      return interaction.update({ content: `Select the member for **${staffActionTitle(flow.action)}** - ${teamLabel(flow.team)}.`, components: [staffUserMenu(key)] });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('staff_rank:')) {
      const key = interaction.customId.split(':')[1];
      const flow = pendingStaffFlow.get(key);
      if (!flow || flow.guildId !== interaction.guildId || flow.actorId !== interaction.user.id) return interaction.reply({ content: 'This staff-management flow expired. Start again from the panel.', flags: MessageFlags.Ephemeral });
      if (!isStaffManager(interaction.member)) return interaction.reply({ content: 'Development staff-management permission is required.', flags: MessageFlags.Ephemeral });
      flow.rankRoleId = interaction.values[0];
      return interaction.showModal(staffReasonModal(key, flow.action));
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_status_select:')) {
      const channelId = interaction.customId.split(':')[1];
      const ticket = data.tickets[channelId];
      if (!ticket || ticket.guildId !== interaction.guildId) return interaction.update({ content: 'Ticket record not found.', components: [] });
      const handlerIds = ticketHandlerRoleIds(guildConfig(interaction.guildId), ticket.type);
      if (!isAdmin(interaction.member) && !hasAnyRole(interaction.member, handlerIds)) return interaction.update({ content: 'Only the configured handler role can update this ticket status.', components: [] });
      if (ticket.status === 'closed') return interaction.update({ content: 'This ticket is already closed.', components: [] });
      const previous = ticket.status;
      const next = interaction.values[0];
      ticket.status = next;
      ticket.statusUpdatedAt = Date.now();
      ticket.statusUpdatedBy = interaction.user.id;
      saveData();
      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (channel?.isTextBased()) {
        await refreshTicketPanel(channel, ticket);
        await channel.send({ embeds: [new EmbedBuilder()
          .setTitle('Ticket Status Updated')
          .setDescription(`Status changed from **${ticketStatusLabel(previous)}** to **${ticketStatusLabel(next)}** by <@${interaction.user.id}>.`)
          .setTimestamp()] }).catch(() => null);
      }
      await sendConfiguredLog(interaction.guild, 'ticket', {
        embeds: [auditEmbed('Development Ticket Status Updated', interaction.user, [
          { name: 'Ticket', value: `<#${channelId}>`, inline: true },
          { name: 'Previous', value: ticketStatusLabel(previous), inline: true },
          { name: 'New Status', value: ticketStatusLabel(next), inline: true },
        ])],
      });
      return interaction.update({ content: `Ticket status updated to **${ticketStatusLabel(next)}**.`, components: [] });
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('vehicle_flags:')) {
      await interaction.deferUpdate();
      const key = interaction.customId.split(':')[1];
      const pending = pendingVehicle.get(key);
      if (!pending || pending.guildId !== interaction.guildId || pending.submitterId !== interaction.user.id) {
        return interaction.editReply({ content: 'This vehicle submission expired. Run /approve vehicle (or /approve-vehicle) again.', components: [] });
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
        sourceTicketChannelId: pending.sourceTicketChannelId || null,
        requesterId: pending.requesterId || pending.submitterId,
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
      if (interaction.customId.startsWith('agreement_sign_modal:')) {
        const requestId = interaction.customId.split(':')[1];
        const request = data.agreementRequests[requestId];
        if (!request) return interaction.reply({ content: 'This agreement request no longer exists.' });
        return finishAgreementSignature(interaction, request);
      }
      if (interaction.customId.startsWith('staff_reason:')) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const key = interaction.customId.split(':')[1];
        const flow = pendingStaffFlow.get(key);
        if (!flow || flow.guildId !== interaction.guildId || flow.actorId !== interaction.user.id) return interaction.editReply('This staff-management flow expired. Start again from the panel.');
        if (!isStaffManager(interaction.member)) return interaction.editReply('Development staff-management permission is required.');
        const reason = interaction.fields.getTextInputValue('reason');
        try {
          const result = await performStaffAction({ guild: interaction.guild, actor: interaction.user, targetUserId: flow.userId, team: flow.team, action: flow.action, rankRoleId: flow.rankRoleId, reason });
          pendingStaffFlow.delete(key);
          const rankText = result.teamRecord.rankRoleId ? ` with rank <@&${result.teamRecord.rankRoleId}>` : '';
          const dmText = result.dmDelivered ? ' DM delivered.' : ' I could not DM them (their DMs may be disabled).';
          return interaction.editReply(`${staffActionTitle(flow.action)}: <@${flow.userId}> - ${teamLabel(flow.team)}${rankText}.${dmText}`);
        } catch (error) { return interaction.editReply(error.message); }
      }
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
