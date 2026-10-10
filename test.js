const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('index.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('bot-data.json', 'utf8'));
const env = fs.readFileSync('.env.example', 'utf8');

assert.strictEqual(pkg.version, '2.11.1');
assert(source.includes('PACKAGED_DATA_PATH'));
assert(source.includes('restoring packaged WCRP backup'));
assert(source.includes('process.env.DISCORD_TOKEN'));
assert(source.includes('process.env.DISCORD_CLIENT_ID'));
assert(!/client\.login\(['"][^'"]+['"]\)/.test(source), 'Discord token appears hard-coded');
assert(env.includes('DISCORD_TOKEN='));
assert(env.includes('DISCORD_CLIENT_ID='));

// Panel-first ticket system and staff management remain intact.
for (const token of [
  "setName('dev-panel')", "setCustomId('open_ticket:leo')", "setCustomId('open_ticket:livery')",
  "setCustomId('open_ticket:commission')", "setCustomId('open_ticket:qa')", "setCustomId('open_ticket:department')", "setCustomId('open_ticket:gang')", "setName('staff-panel')",
  "setName('hire')", "setName('promote')", "setName('demote')", "setName('suspend')",
  "setName('remove-staff')", "setName('blacklist-staff')", "setName('ticket-claim')",
]) assert(source.includes(token), `Missing ${token}`);
assert(!source.includes("setName('leo-ticket')"));


// v2.4.1 staff/ticket/QA routing and deployment workflow.
for (const token of [
  'notifyStaffMember', 'postStaffMovementAnnouncement', 'set-movement-channel', 'developerMovementChannelId', 'qaMovementChannelId',
  'set-qa-notification-role', 'qaNotificationRoleId', 'notifyQAOutcomeMembers', 'DM delivered',
  'ticket_status:', 'ticket_status_select:', 'ticketStatusLabel',
  "setName('vehicle-in-game')", 'handleAssetInGame', 'requesterId', 'sourceTicketChannelId', 'gameStatus',
  'Ticket routing is intentionally singular',
]) assert(source.includes(token), `Missing v2.4.1 token ${token}`);
assert(source.includes('singularTicketHandlerTypes'));
assert(source.includes("singularTicketHandlerTypes.has(type) ? [role.id]"));

// QA lifecycle.
for (const token of [
  "setName('approve-vehicle')", "setName('approve-ymap')", "setName('qa-queue')", "setName('qa-claim')",
  "setName('qa-unclaim')", "setName('qa-retest')", 'qa_review:approve:', 'qa_review:changes:', 'qa_review:deny:',
  'Changes Requested', 'claimedBy', 'retestCount', 'startThread({', 'sourceChannelId', 'qa_transfer:',
]) assert(source.includes(token), `Missing QA token ${token}`);

// Asset registry.
for (const token of [
  "setName('asset-info')", "setName('asset-list')", 'upsertAssetFromSubmission', 'assetKey(', 'transferStatus',
]) assert(source.includes(token), `Missing asset token ${token}`);

// Development tasks.
for (const token of [
  "setName('devtask')", "setName('create')", "setName('assign')", "setName('status')", "setName('note')", "setName('priority')", "setName('deadline')",
  'taskStatusLabel', 'taskPriorityLabel', 'pushTaskHistory', 'Development Task Created',
]) assert(source.includes(token), `Missing task token ${token}`);

// Transfer batches / release notes.
for (const token of [
  "setName('mark-for-transfer')", "setName('transfer-complete')", "setName('transfer-history')",
  "setName('release-notes')", 'transferBatches', 'releaseNotesEmbed', 'Transfer Batch Completed', 'America/New_York',
]) assert(source.includes(token), `Missing transfer token ${token}`);

// Configuration health and logging.
for (const token of [
  "setName('config-check')", 'configHealthEmbed', 'devLogChannelId', 'Development Operations Logs',
]) assert(source.includes(token), `Missing config token ${token}`);


// v2.5.0 privileged-access agreement workflow.
for (const token of [
  "setName('agreement')", "setName('send')", "setName('status')", "setName('revoke')", "setName('preview')",
  'agreement_sign:', 'agreement_decline:', 'agreement_sign_modal:', 'typed_name', 'affirmation', 'I AGREE',
  'agreementRequiredBeforeHire', 'agreementLogChannelId', 'agreementVersion', 'Privileged Access Agreement Signed',
  'must sign the current privileged access agreement', 'agreementRequests', 'agreements',
]) assert(source.includes(token), `Missing agreement token ${token}`);
assert(data.agreements && typeof data.agreements === 'object');
assert(data.agreementRequests && typeof data.agreementRequests === 'object');


// v2.6.0 universal development asset workflow.
for (const token of [
  "setName('approve')", "setName('eup')", "setName('department')", "setName('gang')",
  "setName('in-game')", 'submitGenericQASubmission', 'assetKindLabel', 'assetIdentifierLabel',
  'departmentHandlerRoleIds', 'gangHandlerRoleIds', 'departmentCategoryId', 'gangCategoryId',
  'Department Development Request', 'Gang Development Request', '✅ ${typeLabel} Is Now In Game',
  "setLabel('Department Request')", "setLabel('Gang Request')", "setValue('completed')",
]) assert(source.includes(token), `Missing v2.6.0 token ${token}`);

// Existing role sync.
assert(source.includes("setName('syncrole')"));
assert(source.includes("setName('syncmember')"));
assert(source.includes('findOtherRoleSource'));
assert(source.includes('normalizeMemberRoleCopies'));
assert(source.includes('exactRolesByName'));
assert(source.includes("setDescription('Select a synced role')"));
assert(source.includes("addRoleOption((o) => o.setName('role').setDescription('Select the administrator role"));

assert(Array.isArray(data.syncRoles));
assert(data.staff && typeof data.staff === 'object');
assert(data.tasks && typeof data.tasks === 'object');
assert(data.assets && typeof data.assets === 'object');
assert(data.transferBatches && typeof data.transferBatches === 'object');
assert(pkg.dependencies['discord.js']);

// v2.11.0 owner-only role-sync + security hardening.
assert(source.includes("const ROLE_SYNC_OWNER_COMMANDS = new Set(['syncrole', 'syncmember', 'unsync', 'rolesync'])"), 'Missing owner-only role-sync command set');
assert(source.includes("ROLE_SYNC_OWNER_COMMANDS.has(interaction.commandName) && !isBotOwner(interaction)"), 'Missing central owner-only role-sync runtime gate');
assert(source.includes("Blocked owner-only role-sync command"), 'Missing blocked role-sync security audit');
assert(source.includes("This role-sync command is locked to the WCRP bot owner."), 'Missing owner-only denial response');
assert(pkg.version === '2.11.1', 'Expected package version 2.11.1');




// v2.11.1 unauthorized-guild DM notice.
for (const token of [
  'AuditLogEvent.BotAdd', 'findUnauthorizedGuildContact', 'rejectUnauthorizedGuild', 'unauthorizedGuildDmText',
  'West Coast Gaming Network (WGN)', 'official WGN guilds only', '@teo.dev_', 'guild_owner_fallback', 'dmDelivered',
]) assert(source.includes(token), `Missing v2.11.1 unauthorized-guild notice token ${token}`);
assert(source.includes("await rejectUnauthorizedGuild(guild, 'unauthorized_guild_invite')"), 'guildCreate must reject unauthorized guilds through the DM-and-leave handler');

// v2.11.0 major security suite.
for (const token of [
  "setName('security')", "setName('allow-guild')", "setName('remove-guild')", "setName('lockdown')", "setName('maintenance')",
  "setName('subsystem')", "setName('command-role-add')", "setName('rolesync')", "setName('rollback')", "setName('restore')",
  'registerCommandsForGuild', 'clearCommandsForGuild', 'unauthorized_guild_invite', 'guild-scoped commands',
  'createAutomaticBackup', 'MAX_AUTOMATIC_BACKUPS', 'pre-restore', 'normalizeLoadedData',
  'captureRoleSyncSnapshot', 'restoreRoleSyncSnapshot', 'roleSyncPreview',
  'verifyFiveMRequest', 'FIVE_M_REPLAY_WINDOW_MS', 'FIVEM_VERIFICATION_SECRET_NEXT', 'fivem_replay_rejected',
]) assert(source.includes(token), `Missing v2.11.0 security token ${token}`);
assert(source.includes('Routes.applicationCommands(CLIENT_ID), { body: [] }'), 'Global commands are not cleared');
assert(source.includes('Routes.applicationGuildCommands(CLIENT_ID, guildId)'), 'Commands are not registered per authorized guild');
assert(data.dataSchemaVersion === 5, 'Packaged data schema must be v5');
assert(data.security && typeof data.security === 'object', 'Packaged security data missing');
assert(Array.isArray(data.security.allowedGuildIds) && data.security.allowedGuildIds.length > 0, 'Guild allowlist must be seeded from known configured guilds');
assert(data.security.allowedGuildIds.includes('1418997681254174883'), 'Main WCRP guild must remain allowlisted in the packaged restore seed');
assert(data.security.fivemReplayIds && Object.keys(data.security.fivemReplayIds).length === 0, 'Replay IDs must not ship in the restore seed');
assert(env.includes('FIVEM_VERIFICATION_SECRET_NEXT='), 'FiveM rotation secret env missing');
const fivem = fs.readFileSync('fivem-server.lua', 'utf8');
assert(fivem.includes('payload.sentAt = os.time() * 1000'), 'FiveM sentAt replay field missing');
assert(fivem.includes("payload.requestId = ('wcrp-%d-%06d-%s')"), 'FiveM requestId replay field missing');

console.log('All static tests passed.');

const hardcodedSnowflakes = [...source.matchAll(/[\"'](\d{17,20})[\"']/g)].map((m) => m[1]);
assert(hardcodedSnowflakes.every((id) => id === '939620924213309451'), 'Unexpected hard-coded Discord snowflake found in index.js');
assert(source.includes("const BOT_OWNER_ID = '939620924213309451'"), 'Missing hard-coded bot owner override');

// v2.7.0 global unsync and scoped admin access requests.
for (const token of ["setName('unsync')", "setName('member')", "setName('admin')", "setName('request')", 'admin_request:approve:', 'unsyncMemberEverywhere', 'adminRoleName', 'adminRequests']) assert(source.includes(token), `Missing v2.7.0 token ${token}`);
assert(data.adminRequests && typeof data.adminRequests === 'object');

// v2.8.0 Discord/FiveM verification.
for (const token of ["setName('verification')", "setName('setup-main')", "setName('panel')", '/verify/callback', '/api/fivem/connect', 'FIVEM_VERIFICATION_SECRET', 'guilds.join', 'applyVerificationRoles']) assert(source.includes(token), `Missing verification token ${token}`);
assert(data.verification && typeof data.verification === 'object');

// v2.8.1 manual verification and OAuth guild joining.
for (const token of ["setName('force-verify')", "setName('join')", 'joinVerificationGuild', 'forceVerifyUser', 'Verification Guild Join', 'Member Force Verified']) assert(source.includes(token), `Missing v2.8.1 token ${token}`);

// v2.8.3 two-part verification panel branding and actions.
for (const token of ['FIVEM_CONNECT_URL', "setTitle('West Coast Roleplay Verification')", "setTitle('Connect & Get Verified')", "setLabel('Connect to WCRP Server 1')", "setLabel('Authorize Discord')"]) assert(source.includes(token), `Missing v2.8.3 token ${token}`);

// v2.8.4 ID-based verification setup and owner override.
for (const token of ['BOT_OWNER_ID', 'isBotOwner']) assert(source.includes(token), `Missing v2.8.4 token ${token}`);

// v2.8.5 owner bypass must precede verification control-guild restriction.
assert(source.includes('if (isBotOwner(interaction)) return true;'), 'Owner bypass missing from verification manager');
assert(source.includes("interaction.guildId!==v.mainGuildId&&!isBotOwner(interaction)"), 'Owner bypass missing from /join control-server gate');

// v2.8.8 simplified main-server verification, manual fallback, and health endpoint.
for (const token of ["setName('verified_role')", "setName('unverified_role')", "verification_manual_check", "Get Verified", "url.pathname==='/health'"]) assert(source.includes(token), `Missing v2.8.8 token ${token}`);
for (const removed of ["setName('guild-add')", "setName('guild-remove')", "setName('guild-list')"]) assert(!source.includes(removed), `Obsolete verification command remains: ${removed}`);
assert(!source.includes("That Discord is not registered in the verification network."), '/join should allow any guild the bot is connected to');

// v2.9.0 onboarding, persistence, and notification coverage
assert(source.includes(".setName('authorize')"), 'authorize command missing');
assert(source.includes("setName('everyone')"), 'authorize everyone option missing');
assert(source.includes('authorize_everyone_confirm:'), 'authorize everyone confirmation missing');
assert(source.includes('dmAuthorizationSuccess'), 'authorization success DM missing');
assert(source.includes('dmVerificationSuccess'), 'verification success DM missing');
assert(source.includes('dmGuildAdded'), 'guild added DM missing');
assert(source.includes('dmWelcomeVerification'), 'welcome verification DM missing');
assert(source.includes('verificationSuccessLogEmbed'), 'improved verification log embed missing');
assert(source.includes("manualJoinGuildChoices().filter"), 'admin request guild autocomplete is not using configured /guild add servers');
assert(source.includes("BOT_DATA_PATH || DEFAULT_PERSISTENT_PATH"), 'persistent data path fallback missing');

// v2.9.2 admin request routing / temporary access coverage
assert(source.includes("setName('request-channel')"));
assert(source.includes("setName('duration')"));
assert(source.includes("Temporary Administrator Access Expired"));
assert(source.includes("adminRequestChannelId"));
assert(source.includes("sub === 'remove'"));
assert(source.includes("expireTemporaryAdminRequests"));

// v2.9.3 operations quality-of-life coverage
for (const token of ["setName('setup')", "setName('active')", "setName('data')", "setName('backup')", 'WCRP Setup Status', 'Active Administrator Access', 'Sanitized WCRP data backup', 'WCRP startup self-check']) assert(source.includes(token), `Missing v2.9.3 token ${token}`);

// v2.9.4 verification dedupe: reconnects must not emit a fresh success event.
for (const token of [
  'const wasVerified=record.verified===true;',
  "status:'already_verified'",
  'alreadyVerified:true',
  "if(record.verified){",
  'You are already verified.',
]) assert(source.includes(token), `Missing v2.9.4 verification dedupe token ${token}`);

// v2.9.5 branded OAuth callback page coverage.
for (const token of ['WCRP | Dev Ops','Verification System','Open Discord','Secure Discord OAuth','Awaiting FiveM connection']) assert(source.includes(token), `Missing v2.9.5 OAuth page token ${token}`);


// v2.10.0 compact neon OAuth + v2.9.9 restore-ready config + v2.9.8 separate connect/disconnect logs.
for (const token of [
  "wcrp-dev-logo.png", "setName('connect-logs')", "setName('disconnect-logs')", "setName('connect-logs-off')", "setName('disconnect-logs-off')",
  "/api/fivem/disconnect", 'fiveMConnectionLog', 'connectLogChannelId', 'disconnectLogChannelId', 'fivemSessions',
  'FiveM Player Connected', 'FiveM Player Disconnected'
]) assert(source.includes(token), `Missing OAuth/connection-log token ${token}`);
const fivemResource = fs.readFileSync('fivem-server.lua', 'utf8');
for (const token of ['playerDropped', '/disconnect', 'reportDisconnect']) assert(fivemResource.includes(token), `Missing FiveM connection-log token ${token}`);
assert(fs.existsSync('wcrp-dev-logo.png'), 'WCRP OAuth logo asset missing');
for (const token of ['card-shell','AUTHORIZATION SUCCESSFUL','Awaiting FiveM connection','complete-pill']) assert(source.includes(token), `Missing v2.9.7 OAuth UI token ${token}`);

assert(source.includes('}.status-ring:after{'));
assert(source.includes('@media(max-height:760px)'));
