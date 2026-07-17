// src/matching/matchingEngine.js
//
// The "brain" of Vazhithunai. Two responsibilities:
//   1. Direction/proximity matching — group riders heading the same way
//      (Section 3: bearing + ~150-200m live radius, metro-stop priority weight)
//   2. Must-Reach-By feasibility check — before adding anyone to a group,
//      confirm it doesn't push any existing rider past their deadline
//      (borrowed from the "Public Transit Delay Predictor" logic: estimate
//      added detour time from picking up/dropping a new rider, and reject
//      the match if it blows anyone's deadline)

const EARTH_RADIUS_KM = 6371;
const MATCH_RADIUS_METERS = 200; // Section 3: ~150-200m live radius
const BEARING_TOLERANCE_DEGREES = 35; // "same direction" tolerance
const METRO_STOP_RADIUS_METERS = 300; // proximity that earns "metro feeder" weight
const AVG_CITY_SPEED_KMPH = 22; // rough Chennai traffic-aware average, used for ETA deltas

/* ----------------------------- GEO HELPERS ----------------------------- */

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

/** Haversine distance between two [lat, lng] points, in km. */
export function distanceKm([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Compass bearing in degrees (0-360) from point A to point B. */
export function bearingDegrees([lat1, lng1], [lat2, lng2]) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest angle between two bearings, 0-180. */
function bearingDelta(b1, b2) {
  const diff = Math.abs(b1 - b2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function isWithinMatchRadius(pointA, pointB) {
  return distanceKm(pointA, pointB) * 1000 <= MATCH_RADIUS_METERS;
}

/**
 * Rough estimate of extra minutes a detour (extra pickup/dropoff) adds to
 * an existing rider's trip. Simple linear model against avg city speed —
 * good enough for a hackathon-scale feasibility check; swap for a real
 * routing-API duration-in-traffic call in production.
 */
export function estimateDetourMinutes(extraDistanceKm) {
  return (extraDistanceKm / AVG_CITY_SPEED_KMPH) * 60;
}

/**
 * Is `stopLocation` within priority-weighting range of a known metro/bus stop?
 * @param {[number, number]} stopLocation
 * @param {[number, number][]} knownTransitStops
 */
export function isNearTransitStop(stopLocation, knownTransitStops) {
  return knownTransitStops.some(
    (stop) => distanceKm(stopLocation, stop) * 1000 <= METRO_STOP_RADIUS_METERS
  );
}

/* ----------------------------- MATCHING CORE ----------------------------- */

/**
 * @typedef {Object} PendingRider
 * @property {string} riderId
 * @property {[number, number]} pickup
 * @property {[number, number]} dropoff
 * @property {number} mustReachByEpochMs   // hard deadline for this rider
 * @property {number} requestedAtEpochMs
 */

/**
 * @typedef {Object} RiderGroup
 * @property {PendingRider[]} members
 * @property {number} bearing               // representative direction of the group
 * @property {[number, number]} anchorPickup // first rider's pickup, used as group anchor
 * @property {boolean} metroFeederTag
 */

/**
 * Checks whether `candidate` can join `group` without breaking anyone's
 * Must-Reach-By deadline, and without exceeding vehicle capacity.
 */
export function canJoinGroup(group, candidate, vehicleCapacity = 4) {
  if (group.members.length >= vehicleCapacity) {
    return { ok: false, reason: "capacity_full" };
  }

  // 1. Proximity check — candidate pickup must be within live radius of anchor.
  if (!isWithinMatchRadius(group.anchorPickup, candidate.pickup)) {
    return { ok: false, reason: "out_of_radius" };
  }

  // 2. Direction check — candidate's pickup->dropoff bearing must roughly
  //    match the group's bearing.
  const candidateBearing = bearingDegrees(candidate.pickup, candidate.dropoff);
  if (bearingDelta(group.bearing, candidateBearing) > BEARING_TOLERANCE_DEGREES) {
    return { ok: false, reason: "wrong_direction" };
  }

  // 3. Must-Reach-By feasibility — adding this rider means an extra
  //    pickup + possibly an extra dropoff detour for everyone already
  //    in the group. Estimate the added minutes and reject if it would
  //    blow any existing member's deadline.
  const extraDistanceKm = distanceKm(group.anchorPickup, candidate.pickup);
  const addedMinutes = estimateDetourMinutes(extraDistanceKm);
  const now = Date.now();

  for (const member of group.members) {
    const minutesUntilDeadline = (member.mustReachByEpochMs - now) / 60000;
    if (minutesUntilDeadline - addedMinutes < 0) {
      return { ok: false, reason: "breaks_must_reach_by", member: member.riderId };
    }
  }

  // 4. Candidate's own deadline must also be feasible given group's route.
  const candidateMinutesUntilDeadline =
    (candidate.mustReachByEpochMs - now) / 60000;
  if (candidateMinutesUntilDeadline - addedMinutes < 0) {
    return { ok: false, reason: "candidate_deadline_infeasible" };
  }

  return { ok: true };
}

/**
 * Attempts to place `candidate` into an existing open group, or starts a
 * new one. Mutates and returns the updated list of open groups.
 *
 * @param {RiderGroup[]} openGroups
 * @param {PendingRider} candidate
 * @param {[number, number][]} knownTransitStops
 * @param {number} vehicleCapacity
 */
export function matchRider(openGroups, candidate, knownTransitStops = [], vehicleCapacity = 4) {
  for (const group of openGroups) {
    const result = canJoinGroup(group, candidate, vehicleCapacity);
    if (result.ok) {
      group.members.push(candidate);
      return { group, created: false };
    }
  }

  // No fit found — start a new group anchored on this rider.
  const newGroup = {
    members: [candidate],
    bearing: bearingDegrees(candidate.pickup, candidate.dropoff),
    anchorPickup: candidate.pickup,
    metroFeederTag: isNearTransitStop(candidate.pickup, knownTransitStops),
  };
  openGroups.push(newGroup);
  return { group: newGroup, created: true };
}
