/**
 * ecoCouponService.js
 * Feature: "The Green Dashboard" (part 2)
 * Generates Eco-Coupon codes for drivers/riders when CO2-saving milestones
 * are hit, and maintains the "Driver of the Week" leaderboard (Section 8).
 */

const { v4: uuidv4 } = require('uuid');

const CO2_MILESTONES_KG = [1, 5, 10, 25, 50]; // trigger points for coupon generation
const issuedCoupons = new Map(); // userId -> [{code, milestoneKg, issuedAt, redeemed}]
const driverLeaderboard = new Map(); // driverId -> { ridesCompleted, co2SavedKg, name }

function generateCouponCode() {
  return `ECO-${uuidv4().split('-')[0].toUpperCase()}`;
}

/**
 * Checks a user's updated CO2 total against milestones and issues a new
 * coupon the first time a milestone is crossed. Call this right after
 * carbonFootprintService.recordRideSaving().
 */
function checkAndIssueCoupon(userId, totalKgSaved) {
  const existing = issuedCoupons.get(userId) || [];
  const alreadyIssuedMilestones = new Set(existing.map((c) => c.milestoneKg));

  const newlyCrossed = CO2_MILESTONES_KG.filter(
    (m) => totalKgSaved >= m && !alreadyIssuedMilestones.has(m)
  );

  const newCoupons = newlyCrossed.map((milestoneKg) => ({
    code: generateCouponCode(),
    milestoneKg,
    issuedAt: new Date().toISOString(),
    redeemed: false,
  }));

  if (newCoupons.length) {
    issuedCoupons.set(userId, [...existing, ...newCoupons]);
  }

  return newCoupons; // empty array if no milestone was crossed this ride
}

function getCouponsForUser(userId) {
  return issuedCoupons.get(userId) || [];
}

function redeemCoupon(userId, code) {
  const coupons = issuedCoupons.get(userId) || [];
  const coupon = coupons.find((c) => c.code === code);
  if (!coupon) throw new Error('Coupon not found for this user');
  if (coupon.redeemed) throw new Error('Coupon already redeemed');
  coupon.redeemed = true;
  return coupon;
}

/** Updates a driver's stats after a completed ride (feeds Driver of the Week). */
function recordDriverRide(driverId, driverName, co2SavedKgThisRide) {
  const entry = driverLeaderboard.get(driverId) || {
    name: driverName,
    ridesCompleted: 0,
    co2SavedKg: 0,
  };
  entry.ridesCompleted += 1;
  entry.co2SavedKg += co2SavedKgThisRide;
  entry.name = driverName;
  driverLeaderboard.set(driverId, entry);
}

/** Returns the top N drivers ranked by rides completed this week. */
function getDriverOfTheWeekBoard(limit = 5) {
  return [...driverLeaderboard.entries()]
    .map(([driverId, stats]) => ({ driverId, ...stats }))
    .sort((a, b) => b.ridesCompleted - a.ridesCompleted)
    .slice(0, limit);
}

module.exports = {
  checkAndIssueCoupon,
  getCouponsForUser,
  redeemCoupon,
  recordDriverRide,
  getDriverOfTheWeekBoard,
};
