# WCRP Development Utilities v2.5.0

Discord.js development-operations bot for WCRP. This build combines panel-based development tickets, configurable Development/QA staffing, privileged-access agreement signing, team-specific movement channels, staff and QA DMs, singular QA notification routing, persistent asset tracking, in-game deployment notifications, internal development tasks, Saturday transfer batches/release notes, and cross-server exact-name role synchronization.

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

`/dev-panel` posts the public panel with buttons for LEO Development, Livery, Custom Commission, and Quality Assurance tickets. Each ticket type has its own configurable category and **one selected handler role**. Opening a ticket only grants access to and pings that selected handler role; the bot no longer falls back to pinging the entire Development Team.

Ticket commands:

- `/ticket-claim`
- `/ticket-unclaim`
- `/ticket-add`
- `/ticket-remove`
- `/ticket-close`
- `/ticket-delete`

Every open ticket also has an **Update Status** button. The selected handler role can set Open, In Progress, Waiting on Requester, Waiting on Development, or Ready for QA. Status changes are logged and posted inside the ticket. Close/delete actions create transcript logs.

## Quality Assurance lifecycle

Developers submit vehicles with `/approve-vehicle` and YMAPs with `/approve-ymap`. Vehicle flags are selected through a multi-select. The submission is automatically posted to the configured QA channel. Only the single role selected with `/staff-config set-qa-notification-role` is pinged; the bot no longer pings every configured QA rank/access role.

QA can choose:

- **Approve**
- **Request Changes**
- **Denied**

Every decision requires a reason and creates/uses a QA proof thread for screenshots, clips, test results, and discussion. The result is also posted back into the exact channel where the developer originally submitted the item. The submitter and original requester are DMd with the QA result when possible.

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

The bot automatically posts the pending transfer window every Saturday at **4:00 PM Eastern**. Completing items creates a permanent transfer batch. Release notes are generated from that batch and grouped by item type. Asset registry records are updated when their transfer completes. `/vehicle-in-game spawn_code:` marks an approved vehicle as live in the server, updates the asset/linked transfer, posts an **in game** notice in the original ticket/source channel, pings the original requester, and DMs them when possible.

## Privileged-access agreement signing

`/agreement` is a **global application command**. Authorized staff management uses it in a server and the bot sends the agreement directly to the selected member by DM.

- `/agreement send user: team:` — DM the current agreement to a Development Team candidate, QA candidate, or someone joining both teams.
- `/agreement status user:` — view the member's current signature/version/status.
- `/agreement list` — list recent agreement records for the server.
- `/agreement revoke user: reason:` — revoke the current acknowledgement while preserving the old signature in history.
- `/agreement preview` — preview the exact text being sent.

The recipient must press **Review & Sign**, type their name, and type the exact phrase **I AGREE**. The bot records the Discord user ID/username, typed name, agreement version, team coverage, sender, and timestamp. The recipient receives a receipt; the manager who sent it receives a confirmation DM when possible; and the event is written to the configured agreement audit log.

The agreement prohibits destructive/unauthorized activity such as Discord/server "nuking", mass deletion or permission changes, credential abuse, sabotage, backdoors, leaks, and intentional disruption. It states that WCRP may suspend/revoke access, preserve evidence, report serious misconduct to relevant platforms/authorities, and pursue remedies available under applicable law. It intentionally does **not** claim that a signature guarantees legal liability; enforceability depends on applicable law, jurisdiction, facts, and other circumstances.

Agreement configuration is under `/staff-config`:

- `set-agreement-log-channel` — dedicated permanent agreement audit channel. Falls back to the staff log if not set.
- `set-agreement-version` — changes the required version. Old signatures stay in history, but the new version must be signed for future hiring when enforcement is enabled.
- `set-agreement-required` — enables/disables the pre-hire signature requirement. It defaults to **enabled**.

When agreement enforcement is enabled, `/hire` and the staff-management panel refuse to grant Development/QA roles until the selected member has signed the current agreement for that team. A signature sent for both teams covers both Development and QA.

Typing a name plus `I AGREE` creates a stronger audit record, but it cannot technically prevent someone from entering a false name. Treat the record as an internal acknowledgement and audit trail, not as automatic proof of enforceability in every jurisdiction.

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

Development and QA have independent rank ladders. Suspended/removed/blacklisted roles are configurable. Hire, promote, demote, suspend, unsuspend, remove, blacklist, and unblacklist actions DM the affected member when possible and write a compact permanent staff log similar to `@Member --> Development Team | @Rank | Onboarded | date/time | Approved By: @Manager`, with no callsign field.

Use `/staff-config set-movement-channel team:Development Team channel:#...` and `/staff-config set-movement-channel team:Quality Assurance channel:#...` to select separate public staffing channels. Every hire/promotion/demotion/suspension/removal/blacklist/restoration for that team is also posted to its selected channel. Rank roles are displayed but are not pinged.

Use `/staff-config set-qa-notification-role role:@...` to select the one role that is pinged whenever a new vehicle/YMAP QA submission is posted.

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
- Development and QA staffing movement channels (configured through `/staff-config`)
- One QA submission notification role (configured through `/staff-config`)
- Development Operations log
- Privileged-access agreement log (configured through `/staff-config`)
- Agreement version / pre-hire signature enforcement (configured through `/staff-config`)

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
