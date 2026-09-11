const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('index.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('bot-data.json', 'utf8'));
const env = fs.readFileSync('.env.example', 'utf8');

assert.strictEqual(pkg.version, '2.1.0');
assert(source.includes('process.env.DISCORD_TOKEN'));
assert(source.includes('process.env.DISCORD_CLIENT_ID'));
assert(!/client\.login\(['"][^'"]+['"]\)/.test(source), 'Discord token appears hard-coded');
assert(env.includes('DISCORD_TOKEN='));
assert(env.includes('DISCORD_CLIENT_ID='));

// Ticket panel only: users open tickets through buttons/forms, not four separate ticket-opening commands.
assert(source.includes("setName('dev-panel')"));
assert(source.includes("setCustomId('open_ticket:leo')"));
assert(source.includes("setCustomId('open_ticket:livery')"));
assert(source.includes("setCustomId('open_ticket:commission')"));
assert(source.includes("setCustomId('open_ticket:qa')"));
assert(!source.includes("setName('leo-ticket')"));
assert(!source.includes("setName('livery-ticket')"));
assert(!source.includes("setName('custom-commission')"));
assert(!source.includes("setName('quality-assurance')"));

// Configurable handler roles and logs.
for (const token of [
  'leoHandlerRoleIds', 'liveryHandlerRoleIds', 'commissionHandlerRoleIds', 'qaTicketHandlerRoleIds',
  'transferRoleIds', 'ticketLogChannelId', 'qaLogChannelId', 'transferLogChannelId',
  'configLogChannelId', 'roleSyncLogChannelId',
]) assert(source.includes(token), `Missing ${token}`);

// QA workflow.
assert(source.includes("setName('approve-vehicle')"));
assert(source.includes("setName('approve-ymap')"));
assert(source.includes('qa_review:approve:'));
assert(source.includes('qa_review:deny:'));
assert(source.includes('qa_transfer:'));
assert(source.includes('sourceChannelId'));
assert(source.includes('qaResultEmbed'));
assert(source.includes('markTransferButton'));
assert(source.includes('startThread({'));
assert(source.includes('allowedMentions: { roles: qaRoleIds }'));

// Transfer system.
assert(source.includes("setName('mark-for-transfer')"));
assert(source.includes("setName('transfer-complete')"));
assert(source.includes("setName('transfer-post')"));
assert(source.includes('America/New_York'));
assert(source.includes('Scheduled Transfer List Posted'));

// Cross-server role sync.
assert(source.includes("setName('syncrole')"));
assert(source.includes("setName('syncmember')"));
assert(source.includes('findOtherRoleSource'));
assert(source.includes("sendConfiguredLog(guild, 'role_sync'"));

assert(Array.isArray(data.syncRoles));
assert(pkg.dependencies['discord.js']);
console.log('All static tests passed.');
