// server.js
//
// MERGED entry point. Combines:
//   - vazhithunai-app       (matching, fare lock/split, chat, trust/DB)   [ESM]
//   - vazhithunai-integrator (live tracking, traffic/ETA, green, grievance) [CommonJS]
// into a single Express + Socket.io process on ONE port.
//
// How the merge works:
//   - This file is ESM ("type": "module" in package.json).
//   - src/integrator/** is CommonJS (it has its own package.json with
//     { "type": "commonjs" }, so Node loads that subtree with require()
//     semantics regardless of the parent's "type").
//   - createRequire() lets this ESM file call require() to pull in the
//     integrator's CommonJS routes/services directly.
//
// The two halves were built independently and never shared a rideId.
// The important wiring added here (not in either original codebase):
//   1. After a match is confirmed on POST /api/match, we immediately call
//      the integrator's lockOptimalRoute() with the SAME ride.id, so the
//      live-tracking map and the fare lock refer to one ride, not two.
//   2. After POST /api/rides/:id/complete, we call the integrator's CO2 +
//      eco-coupon services for every rider on that ride, so the Green
//      Dashboard actually populates instead of sitting empty.
//
// Run with: npm start   ->  http://localhost:3001

import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------
// App-side (ESM) modules — matching, fare, chat, DB
// ---------------------------------------------------------------------
import {
  createUser, createDriver, createRide, updateRide, getRide,
  submitReview, getTrustScore, addConnection, getConnectionCount,
} from "./src/db/models.js";
import { matchRider, distanceKm } from "./src/matching/matchingEngine.js";
import { lockGroupFare, splitFareByDistance, calculateDetourSurcharge } from "./src/pricing/fareCalculator.js";
import { sendMessage, getMessages } from "./src/chat/chatService.js";

// ---------------------------------------------------------------------
// Integrator-side (CommonJS) modules — routes for mounting as-is, plus
// direct service imports for the in-process wiring described above.
// ---------------------------------------------------------------------
const trackingRoutes = require("./src/integrator/routes/tracking.routes.js");
const trafficRoutes = require("./src/integrator/routes/traffic.routes.js");
const greenRoutes = require("./src/integrator/routes/green.routes.js");
const grievanceRoutes = require("./src/integrator/routes/grievance.routes.js");
const registerLiveTrackingSocket = require("./src/integrator/sockets/liveTrackingSocket.js");

const { lockOptimalRoute } = require("./src/integrator/services/geoTrackingService.js");
const { recordRideSaving, getUserCo2Summary } = require("./src/integrator/services/carbonFootprintService.js");
const { checkAndIssueCoupon, recordDriverRide } = require("./src/integrator/services/ecoCouponService.js");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // legacy demo UI at "/" — the React app in /frontend is the real UI

const PORT = process.env.PORT || 3001;

// A known metro stop, used for the "metro feeder" tag.
const KNOWN_TRANSIT_STOPS = [[13.0500, 80.2121]]; // Vadapalani Metro

// Rough [lat, lng] for the demo pickup dropdown. Replace with real
// geocoding later.
const PICKUP_COORDS = {
  guindy: [13.0067, 80.2206],
  tidel: [13.0067, 80.2325],
  custom: [13.0500, 80.2121],
};

// In-memory "open groups" the matching engine groups riders into.
const openGroups = [];

// ---------------------------------------------------------------------
// Seed demo data on boot
// ---------------------------------------------------------------------
let demoRider, demoDriver;

async function seedDemoData() {
  demoRider = await createUser({
    name: "You", phone: "9999999999", idVerified: true, gender: "female", age: 24,
  });
  demoDriver = await createDriver({
    name: "Murugan R.", idVerified: true, vehicleType: "auto", location: KNOWN_TRANSIT_STOPS[0],
  });

  const seedRiders = [];
  for (const name of ["Karthik", "Kavitha", "Priya"]) {
    seedRiders.push(await createUser({ name, phone: "9876500000", idVerified: true, gender: "other", age: 26 }));
  }

  for (const seedRider of seedRiders) {
    const ride = await createRide({ riderIds: [demoRider.id, seedRider.id], riderLegs: [], metroFeederTag: null });
    await updateRide(ride.id, { status: "completed" });
    await submitReview(demoRider.id, { rideId: ride.id, positive: true, note: "Good ride." });
    await addConnection(seedRider.id, demoRider.id, ride.id);
  }
  const roughRide = await createRide({ riderIds: [demoRider.id, seedRiders[0].id], riderLegs: [], metroFeederTag: null });
  await updateRide(roughRide.id, { status: "completed" });
  await submitReview(demoRider.id, { rideId: roughRide.id, positive: false, note: "Ran a bit late." });

  console.log(`[seed] Demo rider ${demoRider.name} (${demoRider.id}) and driver ${demoDriver.name} ready.`);
}

// ---------------------------------------------------------------------
// App-side routes (matching, fare, chat, trust)
// ---------------------------------------------------------------------

app.get("/api/me", async (req, res) => {
  const trustScore = await getTrustScore(demoRider.id);
  const connectionCount = await getConnectionCount(demoRider.id);
  res.json({ user: demoRider, trustScore, connectionCount });
});

app.get("/api/me/connections", async (req, res) => {
  const connectionCount = await getConnectionCount(demoRider.id);
  res.json({ connectionCount });
});

// Direction-based matching -> creates/joins a group -> locks + splits fare
// -> ALSO locks the optimal route on the integrator side, using the same
// ride.id, so live tracking and fare are tied to one ride record.
app.post("/api/match", async (req, res) => {
  try {
    const { pickupKey = "guindy", dropoffOffset = { lat: -0.02, lng: 0.001 }, mustReachInMinutes = 30 } = req.body;
    const pickup = PICKUP_COORDS[pickupKey] || PICKUP_COORDS.guindy;
    const dropoff = [pickup[0] + dropoffOffset.lat, pickup[1] + dropoffOffset.lng];

    const candidate = {
      riderId: demoRider.id,
      pickup,
      dropoff,
      mustReachByEpochMs: Date.now() + mustReachInMinutes * 60000,
      requestedAtEpochMs: Date.now(),
    };

    const { group, created } = matchRider(openGroups, candidate, KNOWN_TRANSIT_STOPS, demoDriver.capacity);

    const legs = group.members.map((m) => ({ riderId: m.riderId, distanceKm: distanceKm(m.pickup, m.dropoff) }));
    const ride = await createRide({
      riderIds: group.members.map((m) => m.riderId),
      riderLegs: legs,
      metroFeederTag: group.metroFeederTag ? "metro_feeder" : null,
    });

    const lockResult = lockGroupFare(legs, { trafficIndex: 1.2, matchScarcity: created ? 0.4 : 0 });
    const splitResult = splitFareByDistance(legs, lockResult.lockedTotalFare);

    const lockedRide = await updateRide(ride.id, {
      status: "locked",
      driverId: demoDriver.id,
      lockedFare: lockResult.lockedTotalFare,
      riderLegs: splitResult,
    });

    // --- integration wiring: lock the optimal route under the SAME ride id ---
    const originLatLng = { lat: pickup[0], lng: pickup[1] };
    const destLatLng = { lat: dropoff[0], lng: dropoff[1] };
    let lockedRoute = null;
    try {
      lockedRoute = await lockOptimalRoute(ride.id, originLatLng, destLatLng);
    } catch (routeErr) {
      console.error("[integration] route lock failed:", routeErr.message);
    }

    res.json({
      created,
      ride: lockedRide,
      driver: demoDriver,
      groupSize: group.members.length,
      surgeExplanation: lockResult.surgeExplanation,
      lockedRoute, // frontend can hand this straight to LiveMap
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/rides/:id/confirm", async (req, res) => {
  const ride = await updateRide(req.params.id, { status: "in_progress" });
  res.json({ ride });
});

// Completing a ride ALSO feeds the Green Dashboard: CO2 saved + eco-coupons
// for every rider, and a driver-of-the-week credit — using the ride's own
// riderLegs so distances match what the fare split already used.
app.post("/api/rides/:id/complete", async (req, res) => {
  const ride = await updateRide(req.params.id, { status: "completed" });

  const greenResults = [];
  try {
    const groupSize = (ride.riderLegs || []).length || 1;
    for (const leg of ride.riderLegs || []) {
      const { savedGramsThisRide } = recordRideSaving(leg.riderId, leg.distanceKm, groupSize);
      const summary = getUserCo2Summary(leg.riderId);
      const newCoupons = checkAndIssueCoupon(leg.riderId, summary.totalKgSaved);
      greenResults.push({ riderId: leg.riderId, savedGramsThisRide, summary, newCoupons });
    }
    if (ride.driverId) {
      const totalKm = (ride.riderLegs || []).reduce((sum, l) => sum + l.distanceKm, 0);
      recordDriverRide(ride.driverId, "Driver", totalKm);
    }
  } catch (greenErr) {
    console.error("[integration] green dashboard update failed:", greenErr.message);
  }

  res.json({ ride, green: greenResults });
});

app.get("/api/rides/:id", async (req, res) => {
  const ride = await getRide(req.params.id);
  if (!ride) return res.status(404).json({ error: "not found" });
  res.json({ ride });
});

app.post("/api/detour-quote", (req, res) => {
  const { extraDistanceKm = 0 } = req.body;
  res.json({ surcharge: calculateDetourSurcharge(extraDistanceKm) });
});

app.post("/api/rides/:id/messages", async (req, res) => {
  const message = await sendMessage(req.params.id, req.body);
  res.json({ message });
});
app.get("/api/rides/:id/messages", async (req, res) => {
  const messages = await getMessages(req.params.id);
  res.json({ messages });
});

// ---------------------------------------------------------------------
// Integrator-side routes, now on the SAME app/port as everything above.
// (These still work standalone too — e.g. a rider can still POST
// /api/tracking/ping directly — the wiring above is additive, not a
// replacement for these routes.)
// ---------------------------------------------------------------------
app.use("/api/tracking", trackingRoutes);
app.use("/api/traffic", trafficRoutes);
app.use("/api/green", greenRoutes);
app.use("/api/grievance", grievanceRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", merged: true });
});

// ---------------------------------------------------------------------
// Socket.io — real-time GPS/ETA push, from the integrator module.
// ---------------------------------------------------------------------
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
registerLiveTrackingSocket(io);

seedDemoData()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Vazhithunai (merged) running at http://localhost:${PORT}`);
      console.log(`  - Matching/fare/chat/trust : /api/match, /api/rides/*, /api/me`);
      console.log(`  - Live tracking            : /api/tracking/*  (+ socket.io)`);
      console.log(`  - Traffic/ETA              : /api/traffic/*`);
      console.log(`  - Green dashboard          : /api/green/*`);
      console.log(`  - Grievance layer          : /api/grievance/*`);
    });
  })
  .catch((err) => {
    console.error("Failed to seed demo data:", err);
    process.exit(1);
  });
