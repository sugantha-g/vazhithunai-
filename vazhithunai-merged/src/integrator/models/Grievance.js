/**
 * Grievance.js
 * Shape reference for a filed grievance ticket. See services/grievanceService.js
 * for the actual logic — this file documents the record shape for the team.
 */
class Grievance {
  constructor({ ticketId, userId, rideId, category, description, status, filedAt, expectedResolutionBy }) {
    this.ticketId = ticketId;
    this.userId = userId;
    this.rideId = rideId;
    this.category = category; // 'safety' | 'fare_dispute' | 'driver_behavior' | 'app_bug' | 'other'
    this.description = description;
    this.status = status;
    this.filedAt = filedAt;
    this.expectedResolutionBy = expectedResolutionBy;
  }
}

module.exports = Grievance;
