const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('index.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('bot-data.json', 'utf8'));
const env = fs.readFileSync('.env.example', 'utf8');

assert.strictEqual(pkg.version, '2.3.0');
assert(source.includes('process.env.DISCORD_TOKEN'));
assert(source.includes('process.env.DISCORD_CLIENT_ID'));
assert(!/client\.login\(['"][^'"]+['"]\)/.test(source), 'Discord token appears hard-coded');
assert(env.includes('DISCORD_TOKEN='));
assert(env.includes('DISCORD_CLIENT_ID='));

// Panel-first ticket system and staff management remain intact.
for (const token of [
  "setName('dev-panel')", "setCustomId('open_ticket:leo')", "setCustomId('open_ticket:livery')",
  "setCustomId('open_ticket:commission')", "setCustomId('open_ticket:qa')", "setName('staff-panel')",
  "setName('hire')", "setName('promote')", "setName('demote')", "setName('suspend')",
  "setName('remove-staff')", "setName('blacklist-staff')", "setName('ticket-claim')",
]) assert(source.includes(token), `Missing ${token}`);
assert(!source.includes("setName('leo-ticket')"));

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

// Existing role sync.
assert(source.includes("setName('syncrole')"));
assert(source.includes("setName('syncmember')"));
assert(source.includes('findOtherRoleSource'));

assert(Array.isArray(data.syncRoles));
assert(data.staff && typeof data.staff === 'object');
assert(data.tasks && typeof data.tasks === 'object');
assert(data.assets && typeof data.assets === 'object');
assert(data.transferBatches && typeof data.transferBatches === 'object');
assert(pkg.dependencies['discord.js']);
console.log('All static tests passed.');
