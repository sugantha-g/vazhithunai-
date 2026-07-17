/**
 * Ride.js
 * Lightweight in-memory shape reference for a ride record used by the
 * tracking + traffic services. Swap for a Mongoose/Sequelize model when
 * the team wires up a real database.
 */
class Ride {
  constructor({ rideId, riders, driverId, origin, destination, groupSize }) {
    this.rideId = rideId;
    this.riders = riders;           // [{ userId, dropDistanceKm }]
    this.driverId = driverId;
    this.origin = origin;           // { lat, lng }
    this.destination = destination; // { lat, lng }
    this.groupSize = groupSize;
    this.createdAt = new Date().toISOString();
  }
}

module.exports = Ride;
