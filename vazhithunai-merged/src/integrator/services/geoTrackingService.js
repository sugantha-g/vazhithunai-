/**
 * geoTrackingService.js
 * Feature: "Live Tracking"
 * - Fetches the route from the Map API and LOCKS it as the "Optimal Route"
 *   the moment a ride group is confirmed (mirrors the fare-lock-at-match
 *   principle from Section 4 of the pitch: no surprises mid-ride).
 * - Accepts live GPS pings from the driver's device and checks live
 *   position against the locked route (feeds the "unrequested deviation
 *   flag" safety feature).
 */

const axios = require('axios');
const { MOCK_MODE, PROVIDER, GOOGLE_KEY, MAPBOX_TOKEN, ENDPOINTS } = require('../config/mapConfig');
const { distanceFromRouteMeters, haversineDistanceKm } = require('../utils/geoUtils');

// In-memory store for the demo. Swap for Redis/Postgres in production —
// keyed by rideId so multiple concurrent rides don't collide.
const lockedRoutes = new Map(); // rideId -> { polyline: [{lat,lng}], distanceKm, lockedAt }
const liveTelemetry = new Map(); // rideId -> [{lat, lng, timestamp}]

/**
 * Generates a plausible mock polyline between two points (straight-line
 * interpolation with slight jitter) so the demo map has something to draw
 * without a live API key.
 */
function mockPolyline(origin, destination, steps = 12) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const jitter = (Math.sin(i * 1.7) * 0.0006);
    points.push({
      lat: origin.lat + (destination.lat - origin.lat) * t + jitter,
      lng: origin.lng + (destination.lng - origin.lng) * t + jitter,
    });
  }
  return points;
}

async function fetchRouteFromProvider(origin, destination) {
  if (MOCK_MODE) {
    const polyline = mockPolyline(origin, destination);
    const distanceKm = haversineDistanceKm(origin, destination) * 1.25; // road factor
    return { polyline, distanceKm, source: 'mock' };
  }

  if (PROVIDER === 'google') {
    const { data } = await axios.get(ENDPOINTS.google.directions, {
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        key: GOOGLE_KEY,
      },
    });
    const leg = data.routes?.[0]?.legs?.[0];
    if (!leg) throw new Error('No route returned by Google Directions API');
    // Decode overview_polyline in production (e.g. with @mapbox/polyline);
    // omitted here to keep this file dependency-light.
    return {
      polyline: [origin, destination],
      distanceKm: leg.distance.value / 1000,
      source: 'google',
    };
  }

  // mapbox
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const { data } = await axios.get(`${ENDPOINTS.mapbox.directions}/${coords}`, {
    params: { access_token: MAPBOX_TOKEN, geometries: 'geojson' },
  });
  const route = data.routes?.[0];
  if (!route) throw new Error('No route returned by Mapbox Directions API');
  const polyline = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  return { polyline, distanceKm: route.distance / 1000, source: 'mapbox' };
}

/**
 * Locks the optimal route for a ride at match time. Call this once, right
 * after the rider group is confirmed — this is what Section 4's
 * "locked at match time" fare guarantee is built on top of.
 */
async function lockOptimalRoute(rideId, origin, destination) {
  const route = await fetchRouteFromProvider(origin, destination);
  const record = {
    rideId,
    origin,
    destination,
    polyline: route.polyline,
    distanceKm: Number(route.distanceKm.toFixed(2)),
    source: route.source,
    lockedAt: new Date().toISOString(),
  };
  lockedRoutes.set(rideId, record);
  liveTelemetry.set(rideId, []);
  return record;
}

function getLockedRoute(rideId) {
  return lockedRoutes.get(rideId) || null;
}

/**
 * Ingests a live GPS ping from the driver's app. Returns whether the
 * vehicle has drifted beyond the allowed corridor from the locked route
 * (feeds the "unrequested deviation flag" in the safety layer).
 */
function ingestGpsPing(rideId, { lat, lng }, deviationThresholdMeters = 250) {
  const route = lockedRoutes.get(rideId);
  if (!route) throw new Error(`No locked route found for ride ${rideId}`);

  const ping = { lat, lng, timestamp: new Date().toISOString() };
  const history = liveTelemetry.get(rideId) || [];
  history.push(ping);
  liveTelemetry.set(rideId, history);

  const driftMeters = distanceFromRouteMeters(ping, route.polyline);
  const deviationFlagged = driftMeters > deviationThresholdMeters;

  return {
    rideId,
    currentPosition: ping,
    driftMeters: Math.round(driftMeters),
    deviationFlagged,
  };
}

function getLiveTelemetry(rideId) {
  return liveTelemetry.get(rideId) || [];
}

module.exports = {
  lockOptimalRoute,
  getLockedRoute,
  ingestGpsPing,
  getLiveTelemetry,
};
