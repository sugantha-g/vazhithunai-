// src/index.js
//
// End-to-end demo of the Architect's stack:
//   matching -> fare lock -> proportional split -> chat -> reviews/trust score
//
// Run with: npm run demo

import { createUser, createDriver, createRide, updateRide,
         submitReview, getTrustScore, addConnection, getConnectionCount } from "./db/models.js";
import { matchRider, distanceKm } from "./matching/matchingEngine.js";
import { lockGroupFare, splitFareByDistance, calculateDetourSurcharge } from "./pricing/fareCalculator.js";
import { sendMessage, getMessages } from "./chat/chatService.js";

// A known metro stop near Vadapalani for the "metro feeder" tag demo.
const KNOWN_TRANSIT_STOPS = [[13.0500, 80.2121]]; // Vadapalani Metro

async function main() {
  console.log("\n=== Vazhithunai backend demo ===\n");

  // 1. Create two riders and a driver.
  const riderA = await createUser({ name: "Priya", phone: "9876500001", idVerified: true, gender: "female", age: 24 });
  const riderB = await createUser({ name: "Karthik", phone: "9876500002", idVerified: true, gender: "male", age: 29 });
  const driver = await createDriver({ name: "Murugan", idVerified: true, vehicleType: "auto", location: [13.0500, 80.2121] });

  console.log("Created riders:", riderA.name, riderB.name, "| driver:", driver.name);

  // 2. Matching — both riders picked up near Vadapalani metro, heading
  //    roughly the same direction, each with a Must-Reach-By deadline.
  const now = Date.now();
  const openGroups = [];

  const pendingA = {
    riderId: riderA.id,
    pickup: [13.0500, 80.2121],       // right at the metro stop
    dropoff: [13.0180, 80.2137],      // ~3.5km south
    mustReachByEpochMs: now + 40 * 60000, // 40 min from now
    requestedAtEpochMs: now,
  };
  const pendingB = {
    riderId: riderB.id,
    pickup: [13.0490, 80.2115],       // ~150m from Priya, same direction
    dropoff: [13.0300, 80.2130],      // ~2km south, along the same corridor
    mustReachByEpochMs: now + 35 * 60000,
    requestedAtEpochMs: now,
  };

  const { group: g1 } = matchRider(openGroups, pendingA, KNOWN_TRANSIT_STOPS, driver.capacity);
  const { group: g2, created } = matchRider(openGroups, pendingB, KNOWN_TRANSIT_STOPS, driver.capacity);

  console.log(
    created
      ? "\nRider B started a new group (didn't fit any existing one)."
      : "\nRider B matched into Rider A's group."
  );
  console.log("Group size:", g2.members.length, "| metro feeder tag:", g2.metroFeederTag);

  // 3. Create the ride record for the matched group.
  const legs = g2.members.map((m) => ({
    riderId: m.riderId,
    distanceKm: distanceKm(m.pickup, m.dropoff),
  }));

  const ride = await createRide({
    riderIds: g2.members.map((m) => m.riderId),
    riderLegs: legs,
    metroFeederTag: g2.metroFeederTag ? "metro_feeder" : null,
  });

  // 4. Lock the fare at match time (traffic-aware, off-peak/surge aware).
  const lockResult = lockGroupFare(legs, { trafficIndex: 1.3, isOffPeak: false, matchScarcity: 0.2 });
  const splitResult = splitFareByDistance(legs, lockResult.lockedTotalFare);

  await updateRide(ride.id, {
    status: "locked",
    driverId: driver.id,
    lockedFare: lockResult.lockedTotalFare,
    riderLegs: splitResult,
  });

  console.log("\nFare locked:", lockResult);
  console.log("Split by distance:", splitResult);

  // 4b. Example: Priya requests a short detour.
  const detourFare = calculateDetourSurcharge(0.8); // 0.8km detour
  console.log("\nDetour surcharge for Priya's 0.8km detour: ₹" + detourFare, "(paid directly to driver)");

  // 5. In-app chat, no phone numbers.
  await sendMessage(ride.id, {
    senderId: driver.id,
    senderRole: "driver",
    senderDisplayName: "Driver",
    text: "Running 2 minutes late, call me at 9876543210 if needed", // number should get redacted
  });
  await sendMessage(ride.id, {
    senderId: riderA.id,
    senderRole: "rider",
    senderDisplayName: "Rider 1",
    text: "No problem, we'll wait at the stop.",
  });

  const thread = await getMessages(ride.id);
  console.log("\nChat thread (phone auto-redacted):");
  thread.forEach((m) => console.log(`  [${m.senderDisplayName}] ${m.text}`));

  // 6. Complete the ride, submit reviews, check trust score + connections.
  await updateRide(ride.id, { status: "completed" });

  await submitReview(driver.id, { rideId: ride.id, positive: true, note: "Smooth ride, on time." });
  await submitReview(riderB.id, { rideId: ride.id, positive: true, note: "Friendly, no issues." });

  const driverTrust = await getTrustScore(driver.id);
  console.log("\nDriver trust score:", driverTrust);

  await addConnection(riderA.id, riderB.id, ride.id);
  const connections = await getConnectionCount(riderB.id);
  console.log("Rider B connection count:", connections);

  console.log("\n=== Demo complete ===\n");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
