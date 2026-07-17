// src/pricing/fareCalculator.js
//
// The "Fair-Split Calculator" — a weighted pricing engine (per the Expense
// Splitter blueprint) built around Vazhithunai's actual fare rules
// (Section 4):
//   Fare = base fare + (distance x official per-km tariff rate)
//   Locked at match time using a traffic-aware duration estimate
//   Split proportionally by each rider's actual drop distance
//   Detour surcharge charged only to the requesting rider, formula-based
//   Off-peak discount to smooth demand

// Chennai auto-rickshaw government tariff (adjust to current published rate).
export const TARIFF = {
  baseFareRupees: 30, // covers first ~1.5km, matches typical auto meter minimum
  baseFareCoversKm: 1.5,
  perKmRupees: 15,
  offPeakDiscountPct: 10, // Section 4: off-peak incentive pricing
  surgeStepPct: 15, // % bump per "surge tier" when matches are scarce
};

/**
 * Base fare for a single leg of distance `distanceKm`, using the
 * government tariff — base fare covers the first stretch, then per-km
 * rate applies to the remainder.
 */
export function calculateBaseFare(distanceKm) {
  const billableKm = Math.max(0, distanceKm - TARIFF.baseFareCoversKm);
  return round2(TARIFF.baseFareRupees + billableKm * TARIFF.perKmRupees);
}

/**
 * Applies a traffic-aware duration multiplier at match time. `trafficIndex`
 * is a 1.0-2.0+ style multiplier from a live routing API's
 * duration-in-traffic estimate (1.0 = free flow, 1.5 = 50% slower than
 * free flow, etc). This is what gets "locked" once the group forms —
 * Section 4: "no one faces a surprise increase mid-ride."
 */
export function applyTrafficAdjustment(baseFare, trafficIndex = 1.0) {
  // Traffic affects the ride's duration/cost risk, not a 1:1 fare multiplier —
  // dampen it so a 2x traffic index doesn't literally double the fare.
  const dampenedMultiplier = 1 + (trafficIndex - 1) * 0.4;
  return round2(baseFare * dampenedMultiplier);
}

/**
 * Off-peak discount or surge bump, applied on top of the traffic-adjusted
 * fare. `matchScarcity` is 0 (plenty of matches forming) to 1 (very few) —
 * drives the "transparent surge explanation" shown in the UI.
 */
export function applyDemandAdjustment(fare, { isOffPeak = false, matchScarcity = 0 } = {}) {
  let adjusted = fare;
  let explanation = null;

  if (isOffPeak) {
    adjusted = round2(adjusted * (1 - TARIFF.offPeakDiscountPct / 100));
    explanation = `Off-peak discount applied (-${TARIFF.offPeakDiscountPct}%).`;
  } else if (matchScarcity > 0) {
    const surgeTier = Math.min(3, Math.ceil(matchScarcity * 3)); // tiers 1-3
    const bumpPct = surgeTier * TARIFF.surgeStepPct;
    adjusted = round2(adjusted * (1 + bumpPct / 100));
    explanation = `Fewer matches forming right now (+${bumpPct}%).`;
  }

  return { adjusted, explanation };
}

/**
 * Locks the total group fare at match time. Call this once, when the
 * group is confirmed — the result should be persisted on the ride record
 * (see db/models.js -> rides.lockedFare) and never recalculated later.
 *
 * @param {{riderId: string, distanceKm: number}[]} legs
 * @param {{trafficIndex?: number, isOffPeak?: boolean, matchScarcity?: number}} conditions
 */
export function lockGroupFare(legs, conditions = {}) {
  const totalDistanceKm = legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  const base = calculateBaseFare(totalDistanceKm);
  const trafficAdjusted = applyTrafficAdjustment(base, conditions.trafficIndex ?? 1.0);
  const { adjusted: total, explanation } = applyDemandAdjustment(trafficAdjusted, conditions);

  return {
    totalDistanceKm: round2(totalDistanceKm),
    lockedTotalFare: total,
    surgeExplanation: explanation,
    lockedAt: Date.now(),
  };
}

/**
 * Splits a locked total fare proportionally by each rider's own drop
 * distance — someone going 500m doesn't pay the same as someone going 3km
 * (Section 4).
 *
 * @param {{riderId: string, distanceKm: number}[]} legs
 * @param {number} lockedTotalFare
 */
export function splitFareByDistance(legs, lockedTotalFare) {
  const totalDistanceKm = legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  if (totalDistanceKm === 0) {
    throw new Error("Cannot split fare across zero total distance.");
  }

  return legs.map((leg) => {
    const shareRatio = leg.distanceKm / totalDistanceKm;
    return {
      riderId: leg.riderId,
      distanceKm: round2(leg.distanceKm),
      fareShare: round2(lockedTotalFare * shareRatio),
    };
  });
}

/**
 * Detour surcharge — Section 6: charged only to the rider who requested
 * the deviation, same formula as base fare, paid directly to the driver
 * as an incentive. Keeps "no negotiation, no driver discretion" intact
 * even for detours.
 */
export function calculateDetourSurcharge(extraDistanceKm) {
  return round2(extraDistanceKm * TARIFF.perKmRupees);
}

/** Suggests fair denominations for cash payers when a total doesn't divide cleanly. */
export function suggestExactChange(amountRupees) {
  const rounded = Math.round(amountRupees);
  const denominations = [500, 200, 100, 50, 20, 10];
  let remaining = rounded;
  const breakdown = [];

  for (const note of denominations) {
    const count = Math.floor(remaining / note);
    if (count > 0) {
      breakdown.push({ note, count });
      remaining -= note * count;
    }
  }
  if (remaining > 0) breakdown.push({ note: "coins", count: remaining });

  return { targetAmount: rounded, breakdown };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
