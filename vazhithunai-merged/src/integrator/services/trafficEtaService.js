/**
 * trafficEtaService.js
 * Feature: "Traffic & ETA"
 * - Pulls live duration-in-traffic data to compute a "Traffic Factor"
 *   (how much slower than free-flow the route currently is).
 * - This is also what Section 4 relies on for fare locking: the fare uses
 *   a duration-in-traffic estimate taken once at match time.
 * - Exposes a recompute function for periodic ETA refresh pushed to riders
 *   over the socket connection (see sockets/liveTrackingSocket.js).
 */

const axios = require('axios');
const { MOCK_MODE, PROVIDER, GOOGLE_KEY, MAPBOX_TOKEN, ENDPOINTS } = require('../config/mapConfig');
const { haversineDistanceKm } = require('../utils/geoUtils');

const AVG_FREE_FLOW_KMPH = 32; // typical Chennai arterial free-flow speed

function mockTrafficEstimate(origin, destination) {
  const distanceKm = haversineDistanceKm(origin, destination) * 1.25;
  // Simulate congestion swinging between light and heavy traffic
  const hour = new Date().getHours();
  const isPeak = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
  const trafficFactor = isPeak
    ? +(1.4 + Math.random() * 0.5).toFixed(2)
    : +(1.0 + Math.random() * 0.3).toFixed(2);

  const freeFlowMinutes = (distanceKm / AVG_FREE_FLOW_KMPH) * 60;
  const durationInTrafficMinutes = freeFlowMinutes * trafficFactor;

  return {
    distanceKm: +distanceKm.toFixed(2),
    freeFlowMinutes: Math.round(freeFlowMinutes),
    durationInTrafficMinutes: Math.round(durationInTrafficMinutes),
    trafficFactor,
    reason: isPeak ? 'Peak-hour congestion' : 'Normal traffic conditions',
  };
}

async function fetchTrafficEstimate(origin, destination) {
  if (MOCK_MODE) return mockTrafficEstimate(origin, destination);

  if (PROVIDER === 'google') {
    const { data } = await axios.get(ENDPOINTS.google.distanceMatrix, {
      params: {
        origins: `${origin.lat},${origin.lng}`,
        destinations: `${destination.lat},${destination.lng}`,
        departure_time: 'now',
        key: GOOGLE_KEY,
      },
    });
    const el = data.rows?.[0]?.elements?.[0];
    if (!el || el.status !== 'OK') throw new Error('Distance Matrix lookup failed');
    const freeFlowMinutes = el.duration.value / 60;
    const durationInTrafficMinutes = (el.duration_in_traffic?.value ?? el.duration.value) / 60;
    return {
      distanceKm: +(el.distance.value / 1000).toFixed(2),
      freeFlowMinutes: Math.round(freeFlowMinutes),
      durationInTrafficMinutes: Math.round(durationInTrafficMinutes),
      trafficFactor: +(durationInTrafficMinutes / freeFlowMinutes).toFixed(2),
      reason: durationInTrafficMinutes > freeFlowMinutes * 1.15 ? 'Heavier than usual traffic' : 'Normal traffic conditions',
    };
  }

  // mapbox matrix API
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const { data } = await axios.get(`${ENDPOINTS.mapbox.matrix}/${coords}`, {
    params: { access_token: MAPBOX_TOKEN, annotations: 'duration,distance' },
  });
  const durationSec = data.durations?.[0]?.[1];
  const distanceM = data.distances?.[0]?.[1];
  if (!durationSec) throw new Error('Mapbox matrix lookup failed');
  const distanceKm = distanceM / 1000;
  const freeFlowMinutes = (distanceKm / AVG_FREE_FLOW_KMPH) * 60;
  const durationInTrafficMinutes = durationSec / 60;
  return {
    distanceKm: +distanceKm.toFixed(2),
    freeFlowMinutes: Math.round(freeFlowMinutes),
    durationInTrafficMinutes: Math.round(durationInTrafficMinutes),
    trafficFactor: +(durationInTrafficMinutes / freeFlowMinutes).toFixed(2),
    reason: durationInTrafficMinutes > freeFlowMinutes * 1.15 ? 'Heavier than usual traffic' : 'Normal traffic conditions',
  };
}

/** Converts a traffic estimate into a rider-facing ETA (clock time + minutes remaining). */
function toEtaPayload(estimate, elapsedMinutes = 0) {
  const remainingMinutes = Math.max(0, Math.round(estimate.durationInTrafficMinutes - elapsedMinutes));
  const etaClockTime = new Date(Date.now() + remainingMinutes * 60_000).toISOString();
  return {
    ...estimate,
    remainingMinutes,
    etaClockTime,
  };
}

module.exports = { fetchTrafficEstimate, toEtaPayload };
