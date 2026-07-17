/**
 * grievanceService.js
 * Feature: "Grievance Layer" — the Municipal Grievance Tracker (Section 10)
 * A transparent, trackable complaint desk: every report gets a ticket ID,
 * a visible status, and an expected resolution time — no black-box support.
 */

const { v4: uuidv4 } = require('uuid');

const STATUS = Object.freeze({
  RECEIVED: 'Received',
  UNDER_REVIEW: 'Under Review',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
});

// Expected resolution windows by category, in hours — shown to the user
// immediately on submission so they're never guessing.
const RESOLUTION_SLA_HOURS = {
  safety: 4,
  fare_dispute: 24,
  driver_behavior: 48,
  app_bug: 72,
  other: 48,
};

const grievances = new Map(); // ticketId -> grievance record

function fileGrievance({ userId, rideId, category, description, location }) {
  const ticketId = `GRV-${uuidv4().split('-')[0].toUpperCase()}`;
  const slaHours = RESOLUTION_SLA_HOURS[category] || RESOLUTION_SLA_HOURS.other;
  const filedAt = new Date();
  const expectedResolutionBy = new Date(filedAt.getTime() + slaHours * 60 * 60 * 1000);

  const record = {
    ticketId,
    userId,
    rideId: rideId || null,
    category,
    description,
    location: location || null,
    status: STATUS.RECEIVED,
    filedAt: filedAt.toISOString(),
    expectedResolutionBy: expectedResolutionBy.toISOString(),
    history: [{ status: STATUS.RECEIVED, at: filedAt.toISOString(), note: 'Grievance filed' }],
  };

  grievances.set(ticketId, record);
  return record;
}

function getGrievance(ticketId) {
  const record = grievances.get(ticketId);
  if (!record) throw new Error(`No grievance found with ticket ${ticketId}`);
  return record;
}

function getGrievancesForUser(userId) {
  return [...grievances.values()].filter((g) => g.userId === userId);
}

function updateGrievanceStatus(ticketId, newStatus, note = '') {
  const record = getGrievance(ticketId);
  if (!Object.values(STATUS).includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  record.status = newStatus;
  record.history.push({ status: newStatus, at: new Date().toISOString(), note });
  return record;
}

/** Simple time-remaining helper for the UI's countdown display. */
function getResolutionCountdown(ticketId) {
  const record = getGrievance(ticketId);
  const remainingMs = new Date(record.expectedResolutionBy).getTime() - Date.now();
  return {
    ticketId,
    status: record.status,
    remainingMinutes: Math.max(0, Math.round(remainingMs / 60000)),
    overdue: remainingMs < 0 && record.status !== STATUS.RESOLVED,
  };
}

module.exports = {
  STATUS,
  fileGrievance,
  getGrievance,
  getGrievancesForUser,
  updateGrievanceStatus,
  getResolutionCountdown,
};
