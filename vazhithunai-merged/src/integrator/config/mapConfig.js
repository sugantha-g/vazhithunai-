/**
 * mapConfig.js
 * Central place to switch between Google Maps Platform, Mapbox, or the
 * built-in mock/simulation mode used for offline hackathon demos.
 *
 * To go live: set MAP_PROVIDER + the matching API key in .env and flip
 * FORCE_MOCK_MODE=false. No other file needs to change — every service
 * reads MOCK_MODE from here.
 */

require('dotenv').config();

const PROVIDER = process.env.MAP_PROVIDER || 'google';
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';

const hasRealKey =
  (PROVIDER === 'google' && GOOGLE_KEY.length > 0) ||
  (PROVIDER === 'mapbox' && MAPBOX_TOKEN.length > 0);

const MOCK_MODE = process.env.FORCE_MOCK_MODE === 'true' || !hasRealKey;

module.exports = {
  PROVIDER,
  GOOGLE_KEY,
  MAPBOX_TOKEN,
  MOCK_MODE,
  ENDPOINTS: {
    google: {
      directions: 'https://maps.googleapis.com/maps/api/directions/json',
      distanceMatrix: 'https://maps.googleapis.com/maps/api/distancematrix/json',
    },
    mapbox: {
      directions: 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic',
      matrix: 'https://api.mapbox.com/directions-matrix/v1/mapbox/driving',
    },
  },
};
