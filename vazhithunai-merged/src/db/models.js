// src/db/models.js
//
// Schema + access helpers for:
//   - users (riders)          -> "users" collection
//   - drivers (verified IDs)  -> "drivers" collection
//   - rides (active/completed states) -> "rides" collection
//   - reviews (feeds trust score)     -> "reviews" collection
//   - connections (Instagram-style, one-directional adds) -> "connections"
//
// These map directly to the app concept:
//   - verified driver IDs -> Trust & Safety (Section 6)
//   - review-derived threshold trust score, not raw star average
//   - one-directional connections, locked to shared-ride pairs only

import { db } from "./firestore.js";

/* ----------------------------- USERS ----------------------------- */

/**
 * @typedef {Object} UserRecord
 * @property {string} id
 * @property {string} name
 * @property {string} phone            // stored server-side only, never exposed via chat
 * @property {boolean} idVerified      // result of OCR ID scan step
 * @property {"male"|"female"|"other"} gender
 * @property {number} age
 * @property {Object} genderPreference // { womenOnly: boolean } - only meaningful/shown for female users
 * @property {number} ageRangePref     // e.g. { min, max }
 */

export async function createUser(user) {
  const record = {
    name: user.name,
    phone: user.phone,
    idVerified: user.idVerified ?? false,
    gender: user.gender,
    age: user.age,
    genderPreference: user.gender === "female" ? { womenOnly: !!user.womenOnly } : null,
    agePreference: user.agePreference ?? null,
    createdAt: Date.now(),
  };
  const ref = await db.collection("users").add(record);
  return { id: ref.id, ...record };
}

export async function getUser(userId) {
  const doc = await db.collection("users").doc(userId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/* ----------------------------- DRIVERS ----------------------------- */

/**
 * @typedef {Object} DriverRecord
 * @property {string} id
 * @property {string} name
 * @property {boolean} idVerified
 * @property {string} vehicleType      // "auto" | "cab"
 * @property {number} capacity         // 4 for auto, 6-7 for cab class
 * @property {[number, number]} location // [lat, lng]
 */

export async function createDriver(driver) {
  const record = {
    name: driver.name,
    idVerified: driver.idVerified ?? false,
    vehicleType: driver.vehicleType,
    capacity: driver.vehicleType === "auto" ? 4 : driver.capacity ?? 6,
    location: driver.location,
    beckn_provider_id: driver.becknProviderId ?? null, // maps to Beckn network identity
    createdAt: Date.now(),
  };
  const ref = await db.collection("drivers").add(record);
  return { id: ref.id, ...record };
}

/* ----------------------------- RIDES ----------------------------- */

/**
 * Ride state machine: "matching" -> "locked" -> "in_progress" -> "completed" | "cancelled"
 *
 * @typedef {Object} RideRecord
 * @property {string} id
 * @property {"matching"|"locked"|"in_progress"|"completed"|"cancelled"} status
 * @property {string[]} riderIds
 * @property {Object[]} riderLegs      // [{ riderId, pickup, dropoff, distanceKm, fareShare }]
 * @property {string|null} driverId
 * @property {number} lockedFare       // total fare locked at match time
 * @property {number} createdAt
 * @property {number|null} etaAtLastUpdate
 * @property {string} metroFeederTag   // optional UI tag if pickup near a transit stop
 */

export async function createRide(ride) {
  const record = {
    status: "matching",
    riderIds: ride.riderIds ?? [],
    riderLegs: ride.riderLegs ?? [],
    driverId: null,
    lockedFare: null,
    createdAt: Date.now(),
    etaAtLastUpdate: null,
    metroFeederTag: ride.metroFeederTag ?? null,
  };
  const ref = await db.collection("rides").add(record);
  return { id: ref.id, ...record };
}

export async function updateRide(rideId, patch) {
  await db.collection("rides").doc(rideId).update(patch);
  const doc = await db.collection("rides").doc(rideId).get();
  return { id: doc.id, ...doc.data() };
}

export async function getRide(rideId) {
  const doc = await db.collection("rides").doc(rideId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/* ----------------------------- REVIEWS + TRUST SCORE ----------------------------- */

/**
 * Reviews feed the threshold-based trust score (Section 6):
 * "% positive over most recent N rides" — not a raw star average,
 * so one outlier can't swing it and it can't be inflated permanently
 * by early good luck.
 */

export async function submitReview(targetUserId, { rideId, positive, note }) {
  await db.collection("reviews").add({
    targetUserId,
    rideId,
    positive: !!positive,
    note: note ?? "",
    createdAt: Date.now(),
  });
}

export async function getTrustScore(targetUserId, windowSize = 20) {
  const all = await db.collection("reviews").listAll();
  const forUser = all
    .map((d) => d.data())
    .filter((r) => r.targetUserId === targetUserId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, windowSize);

  if (forUser.length === 0) {
    return { rideCount: 0, positivePct: null, sampleSize: 0 };
  }

  const positiveCount = forUser.filter((r) => r.positive).length;
  return {
    rideCount: forUser.length,
    positivePct: Math.round((positiveCount / forUser.length) * 100),
    sampleSize: forUser.length,
  };
}

/* ----------------------------- CONNECTIONS ----------------------------- */

/**
 * Instagram-style, one-directional "add" — no mutual confirmation needed.
 * Locked to pairs who've actually shared a completed ride, to close the
 * obvious spam/fake-add vector. Purely a social signal — NOT the trust score.
 */

export async function addConnection(fromUserId, toUserId, rideId) {
  const ride = await getRide(rideId);
  if (!ride || ride.status !== "completed") {
    throw new Error("Can only add a connection after a completed shared ride.");
  }
  if (!ride.riderIds.includes(fromUserId) || !ride.riderIds.includes(toUserId)) {
    throw new Error("Both users must have been part of this ride to connect.");
  }
  await db.collection("connections").add({
    fromUserId,
    toUserId,
    rideId,
    createdAt: Date.now(),
  });
}

export async function getConnectionCount(userId) {
  const all = await db.collection("connections").listAll();
  return all.map((d) => d.data()).filter((c) => c.toUserId === userId).length;
}
