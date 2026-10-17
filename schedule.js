'use strict';

// Weekly transfer schedule helpers. Dependency-free (uses Intl only) so they can be unit tested anywhere.

const TRANSFER_WEEKDAY = 6; // Saturday (0 = Sunday ... 6 = Saturday)
const TRANSFER_HOUR = 16; // 4:00 PM in the configured TIMEZONE (matches the Saturday transfer scheduler)
const TRANSFER_MINUTE = 0;

function zonedParts(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(ms));
  const out = {};
  for (const part of parts) if (part.type !== 'literal') out[part.type] = Number(part.value);
  return out;
}

// Converts a wall-clock time in `timeZone` to a UTC millisecond timestamp (DST safe).
function zonedWallTimeToUtc(year, month, day, hour, minute, timeZone) {
  const wanted = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = wanted;
  for (let i = 0; i < 4; i += 1) {
    const p = zonedParts(guess, timeZone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const diff = shown - wanted;
    if (diff === 0) break;
    guess -= diff;
  }
  return guess;
}

// Returns the unix timestamp (seconds) of the next transfer window that is still in the future.
function nextTransferTimestamp(nowMs = Date.now(), timeZone = 'America/New_York', options = {}) {
  const weekday = options.weekday ?? TRANSFER_WEEKDAY;
  const hour = options.hour ?? TRANSFER_HOUR;
  const minute = options.minute ?? TRANSFER_MINUTE;
  const now = zonedParts(nowMs, timeZone);
  const todayDow = new Date(Date.UTC(now.year, now.month - 1, now.day)).getUTCDay();
  let daysAhead = (weekday - todayDow + 7) % 7;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const day = new Date(Date.UTC(now.year, now.month - 1, now.day + daysAhead));
    const utc = zonedWallTimeToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hour, minute, timeZone);
    if (utc > nowMs) return Math.floor(utc / 1000);
    daysAhead += 7;
  }
  throw new Error('Could not compute next transfer time.');
}

// Text pasted into a ticket when its item is marked for transfer ("pushed").
function pushedTicketMessage(unixSeconds) {
  return [
    '**This ticket has been marked as pushed.**',
    `This means that your request has been fulfilled and is awaiting transfer which normally occurs: **Saturday** <t:${unixSeconds}:F> (<t:${unixSeconds}:R>)`,
    '',
    '-# Your item(s) may come ingame earlier than this time, but if not, they will be in on the next transfer.',
  ].join('\n');
}

// Text pasted into a ticket when a handler claims it.
function claimedTicketMessage(userId) {
  return [
    `Hello, my name is <@${userId}> & I will be assisting you today. 👋`,
    '-# During this ticket, please avoid repeatedly mentioning/pinging repeatedly as this will only increase the time it takes for your request to be completed.',
  ].join('\n');
}

module.exports = {
  TRANSFER_WEEKDAY,
  TRANSFER_HOUR,
  TRANSFER_MINUTE,
  nextTransferTimestamp,
  pushedTicketMessage,
  claimedTicketMessage,
};
