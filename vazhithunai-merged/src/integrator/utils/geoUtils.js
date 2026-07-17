/**
 * geoUtils.js
 * Pure math helpers used across tracking + traffic services.
 * No external calls here — keep this file dependency-free and testable.
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in kilometers. */
function haversineDistanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Compass bearing (0-360) from point a to point b. */
function bearingDegrees(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/** How far (meters) a live GPS point has drifted from the locked route polyline. */
function distanceFromRouteMeters(point, routePoints) {
  let minKm = Infinity;
  for (const rp of routePoints) {
    const d = haversineDistanceKm(point, rp);
    if (d < minKm) minKm = d;
  }
  return minKm * 1000;
}

module.exports = { haversineDistanceKm, bearingDegrees, distanceFromRouteMeters };
