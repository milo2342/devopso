# WCRP Development Utilities

WCRP Development Utilities is a Discord bot for development ticketing, Quality Assurance, Saturday transfer management, and exact-name cross-server role synchronization.

## Railway variables

The bot contains no hard-coded Discord token, client ID, guild ID, role ID, or channel ID.

Add these variables to Railway:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
TIMEZONE=America/New_York
BOT_DATA_PATH=bot-data.json
```

For persistent Railway storage, mount a Railway Volume at `/data` and use:

```env
BOT_DATA_PATH=/data/bot-data.json
```

Enable **Server Members Intent** and **Message Content Intent** in the Discord Developer Portal.

Recommended bot permissions:

- Manage Roles
- Manage Channels
- Manage Threads
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- View Channels
- Mention @everyone, @here, and All Roles (needed if configured handler/QA roles are not mentionable)

The bot's highest Discord role must sit above every role it needs to synchronize.

## Development ticket panel

Tickets are panel-driven. Administrators use:

```text
/dev-panel
```

The panel contains buttons for:

- LEO Ticket
- Livery Ticket
- Custom Commission
- Quality Assurance

A user presses a button and immediately receives the matching guided form. The completed form creates a private ticket and automatically gives access to the configured handler role for that ticket type.

The configured handler roles are pinged when the ticket is first created. Closing and deleting tickets do not generate unnecessary handler-role pings.

Ticket management commands:

- `/ticket-add user:`
- `/ticket-remove user:`
- `/ticket-close`
- `/ticket-delete`

Only the opener, configured handler team, or an administrator can close a ticket. Only the configured handler team or an administrator can delete it, and it must be closed first.

Closing/deleting generates a transcript in the configured ticket log channel.

## Role and permission configuration

Use `/dev-config add-role` and `/dev-config remove-role` to configure:

- Developer Command Access
- Quality Assurance Reviewer
- LEO Ticket Handler
- Livery Ticket Handler
- Commission Ticket Handler
- QA Ticket Handler
- Transfer Manager

If a dedicated ticket-handler role is not configured, LEO/livery/commission tickets fall back to the Developer roles and QA tickets fall back to the QA Reviewer roles.

Use `/dev-config set-category` to configure a separate category for each ticket type.

Use `/dev-config set-channel` to configure:

- Quality Assurance Submissions
- Saturday Transfer
- Ticket / Transcript Logs
- Quality Assurance Logs
- Transfer Logs
- Configuration Logs
- Role Sync Logs
- Legacy / Fallback Log Channel

Use `/dev-config view` at any time to see the complete configuration.

Configuration changes and panel posting can be permanently recorded in the configured Configuration Log channel.

## Vehicle QA approval

Developers use:

```text
/approve-vehicle spawn_code: vehicle_name: other_flags: notes:
```

After the command, the developer selects every applicable vehicle flag from the multi-select menu. Built-in flags include:

- Bulletproof
- Bulletproof Tires
- Nitrous
- Armored
- Weaponized
- Custom Handling
- Emergency Lighting / ELS
- Custom Audio
- Drift Setup
- No Special Flags

The bot then automatically posts the vehicle QA embed in the configured **Quality Assurance Submissions** channel and pings the configured **Quality Assurance Reviewer** role(s).

The QA embed contains **Approve** and **Denied** buttons. A configured QA reviewer must provide a reason before the decision is saved.

When reviewed, the bot:

1. Updates the QA submission embed.
2. Creates a proof thread from the QA message for screenshots, clips, test results, and other evidence.
3. Logs the QA result in the configured QA log channel.
4. Posts a separate Approved/Denied result embed back in the exact channel where the developer originally ran `/approve-vehicle`.
5. If approved, adds a **Mark for Transfer** button to that result embed.

Pressing **Mark for Transfer** adds the approved item to the Saturday transfer queue and disables the button so it cannot be added twice.

## YMAP QA approval

Developers use:

```text
/approve-ymap resource: map_name: location: notes:
```

YMAP submissions use the same QA channel, reviewer-role ping, approve/denied buttons, required reason, proof thread, QA logging, original-channel result embed, and Mark for Transfer flow.

## Saturday transfer system

Manual transfer command:

```text
/mark-for-transfer type: name: identifier: notes:
```

Supported types:

- Vehicle
- YMAP
- Livery
- EUP
- Script
- Other

Transfer commands:

- `/transfer-list`
- `/transfer-complete id:` (use `ALL` to complete every pending item)
- `/transfer-post`

The configured Transfer Manager role can complete and manually post transfers. Developers can also mark items for transfer.

At **4:00 PM Eastern Time every Saturday**, the bot automatically posts the current pending transfer list in the configured transfer channel. `America/New_York` is used so daylight-saving time is handled correctly.

Transfer adds, completions, manual posts, scheduled posts, and QA-to-transfer actions are written to the configured Transfer Log channel.

## Cross-server role sync

The bot synchronizes configured role names by exact role name across every mutual Discord server.

Commands:

- `/syncrole add role:`
- `/syncrole remove name:`
- `/syncrole list`
- `/syncrole diagnose name:`
- `/syncmember user:`

Example: if `Administrator` is configured for sync and a member has the exact role `Administrator` in one mutual server, the bot will add an exact-name `Administrator` role to that member in other mutual servers where that role exists and the bot can manage it.

The sync also runs when a member joins another mutual server. Role-sync actions and manual sync actions can be written to the configured Role Sync Log channel.

`/syncrole diagnose` reports whether each mutual server has the exact role and whether Discord role hierarchy allows the bot to manage it.

## Logging coverage

The bot supports separate permanent Discord log channels for:

- Ticket creation, access changes, close/delete transcripts
- QA submissions and QA decisions
- Transfer queue changes and weekly transfer posting
- Development configuration changes
- Cross-server role synchronization

If a specialized log channel is not configured, the optional Legacy / Fallback Log Channel can be used as the fallback.

## Data storage

`bot-data.json` stores:

- Synced exact role names
- Per-guild handler roles
- Ticket categories
- QA/transfer/log channels
- Open and closed ticket metadata
- QA submissions and decisions
- Proof-thread/result-message references
- Transfer queue entries
- Weekly scheduler state

Do not store the real Discord token in the repository. Keep the real `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` in Railway variables.
