/**
 * carbonFootprintService.js
 * Feature: "The Green Dashboard" (part 1)
 * Estimates CO2 saved by riders sharing a group ride instead of each
 * taking a solo auto/cab for the same distance.
 *
 * Emission factors are grams CO2 per passenger-km, approximate averages
 * for Indian urban transport (solo auto vs shared group auto/cab).
 */

const EMISSION_FACTOR_SOLO_AUTO_G_PER_KM = 113; // solo share-auto trip, per passenger
const EMISSION_FACTOR_SHARED_G_PER_KM = 113; // same vehicle, but...
// ...the saving comes from dividing one vehicle's emissions across N riders
// instead of N vehicles each emitting solo. That's modeled directly below.

/**
 * @param {number} distanceKm - distance this rider traveled
 * @param {number} groupSize - number of riders who shared this vehicle
 */
function estimateCo2SavedGrams(distanceKm, groupSize) {
  if (groupSize <= 1) return 0;

  const soloEmissions = distanceKm * EMISSION_FACTOR_SOLO_AUTO_G_PER_KM; // if this rider had gone alone
  const sharedEmissionsPerRider =
    (distanceKm * EMISSION_FACTOR_SHARED_G_PER_KM) / groupSize; // this rider's share of one vehicle

  const savedGrams = soloEmissions - sharedEmissionsPerRider;
  return Math.max(0, Math.round(savedGrams));
}

/** Running per-user CO2 ledger, in-memory for the demo. */
const co2Ledger = new Map(); // userId -> { totalGrams, rideCount }

function recordRideSaving(userId, distanceKm, groupSize) {
  const savedGrams = estimateCo2SavedGrams(distanceKm, groupSize);
  const entry = co2Ledger.get(userId) || { totalGrams: 0, rideCount: 0 };
  entry.totalGrams += savedGrams;
  entry.rideCount += 1;
  co2Ledger.set(userId, entry);
  return { savedGramsThisRide: savedGrams, lifetime: { ...entry } };
}

function getUserCo2Summary(userId) {
  const entry = co2Ledger.get(userId) || { totalGrams: 0, rideCount: 0 };
  return {
    userId,
    totalKgSaved: +(entry.totalGrams / 1000).toFixed(2),
    rideCount: entry.rideCount,
    // Rough "trees planted equivalent" for a fun, human-readable stat on the dashboard
    treesEquivalent: +((entry.totalGrams / 1000) / 21).toFixed(2), // ~21kg CO2/tree/year
  };
}

module.exports = { estimateCo2SavedGrams, recordRideSaving, getUserCo2Summary };
