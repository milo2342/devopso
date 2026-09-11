# WCRP Development Utilities v2.3.0

Discord.js development-operations bot for WCRP. This build combines panel-based development tickets, Development/QA staffing, QA approvals and proof threads, a persistent asset registry, internal development tasks, Saturday transfer batches/release notes, permanent logs, and cross-server exact-name role synchronization.

## Railway / environment variables

Keep secrets out of GitHub. Configure these in Railway:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
TIMEZONE=America/New_York
BOT_DATA_PATH=/data/bot-data.json
```

Mount a Railway volume at `/data` and use `BOT_DATA_PATH=/data/bot-data.json` so configuration, staff history, tickets, QA records, tasks, assets, and transfer history survive redeploys.

Enable **Server Members Intent**. The bot needs Manage Roles, Manage Channels, Manage Threads, Send Messages, Read Message History, Attach Files, Embed Links, and View Channels. Its highest role must be above every role it manages.

## Ticket system

`/dev-panel` posts the public panel with buttons for LEO Development, Livery, Custom Commission, and Quality Assurance tickets. Each ticket type has its own configurable handler roles/category.

Ticket commands:

- `/ticket-claim`
- `/ticket-unclaim`
- `/ticket-add`
- `/ticket-remove`
- `/ticket-close`
- `/ticket-delete`

Close/delete actions create transcript logs.

## Quality Assurance lifecycle

Developers submit vehicles with `/approve-vehicle` and YMAPs with `/approve-ymap`. Vehicle flags are selected through a multi-select. The submission is automatically posted to the configured QA channel and the configured QA role is pinged.

QA can choose:

- **Approve**
- **Request Changes**
- **Denied**

Every decision requires a reason and creates/uses a QA proof thread for screenshots, clips, test results, and discussion. The result is also posted back into the exact channel where the developer originally submitted the item.

Additional QA commands:

- `/qa-queue` — pending QA submissions, age, and claim owner.
- `/qa-claim id:` — claim a submission so reviewers do not duplicate testing.
- `/qa-unclaim id:` — release a QA claim.
- `/qa-retest id: changes:` — return a denied/changes-requested submission to QA without losing its history.
- `/qa-stats [reviewer]` — approval, denial, changes-requested, pending, and claim statistics.

Duplicate pending vehicle/YMAP identifiers are blocked. Already-approved vehicle spawn codes are also detected before a new QA submission is created.

## Asset registry

QA decisions automatically update a persistent asset record. Records track the identifier/spawn code, name, flags, QA status, reviewer, QA reason, QA submission ID, transfer ID/status, and history.

- `/asset-info identifier:` — view one exact asset record.
- `/asset-list [type]` — browse tracked vehicles, YMAPs, liveries, EUP, scripts, or other assets.

Approved QA results include **Mark for Transfer**, which links the asset record to the transfer item.

## Development task system

`/devtask` provides an internal work tracker:

- `create` — title, type, description, priority, optional assignee, optional due date.
- `view` — show one task.
- `assign` — assign or hand over a task to another developer.
- `status` — Backlog, In Progress, Blocked, Ready for QA, or Complete.
- `note` — permanent internal task note.
- `priority` — change Low / Normal / High / Urgent priority.
- `deadline` — set a due date or clear it.
- `list` — list tasks, optionally filtered by status.

Tasks retain history and use the configurable Development Operations log channel.

## Saturday transfers

- `/mark-for-transfer`
- `/transfer-list`
- `/transfer-complete`
- `/transfer-post`
- `/transfer-history`
- `/release-notes [batch_id]`

The bot automatically posts the pending transfer window every Saturday at **4:00 PM Eastern**. Completing items creates a permanent transfer batch. Release notes are generated from that batch and grouped by item type. Asset registry records are updated when their transfer completes.

## Development / QA staff management

Configure staff with `/staff-config` and post the interactive management panel with `/staff-panel`.

Direct actions:

- `/hire`
- `/promote`
- `/demote`
- `/suspend`
- `/unsuspend`
- `/remove-staff`
- `/blacklist-staff`
- `/unblacklist-staff`

Records/utilities:

- `/staff-profile`
- `/staff-roster`
- `/staff-note`
- `/staff-history`

Development and QA have independent rank ladders. Suspended/removed/blacklisted roles are configurable, and every staffing action is permanently logged.

## Development configuration

`/dev-config` configures:

- Developer command roles
- QA reviewer roles
- LEO/Livery/Commission/QA ticket-handler roles
- Transfer Manager roles
- Ticket categories
- QA submission channel
- Saturday transfer channel
- Ticket/transcript log
- QA log
- Transfer log
- Configuration log
- Role-sync log
- Staff log
- Development Operations log

Run `/config-check` to validate configured roles/channels plus the bot's Manage Roles, Manage Channels, Manage Threads, view, and send-message permissions.

`/dev-overview` shows open tickets, pending QA, pending transfers, open/blocked development tasks, approved assets, active developers/QA, and the next transfer window.

## Cross-server role synchronization

- `/syncrole add role:` — begin syncing an exact role name.
- `/syncrole remove name:`
- `/syncrole list`
- `/syncrole diagnose name:`
- `/syncmember user:`

If a configured exact-name role exists in multiple servers using the bot, the bot mirrors that role for mutual members. No guild IDs, role IDs, bot token, or client ID are hard-coded.

## GitHub layout

Everything stays at repository root:

```text
.env.example
.gitignore
README.md
bot-data.json
index.js
package.json
test.js
```

## Validation

```bash
npm install
npm run check
npm test
npm start
```
