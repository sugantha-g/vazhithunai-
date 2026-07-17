/**
 * api.js
 * Single axios instance + typed helper calls for all four Integrator
 * features. Keeps components free of raw fetch/axios calls.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const client = axios.create({ baseURL: BASE_URL });

// ---- Matching, fare, chat, trust (from the app backend) ----
// Same origin as everything below now that both backends are merged
// onto one port -- no second axios instance needed.
export const getMe = () => client.get('/me').then((r) => r.data);

export const requestMatch = (payload) =>
  client.post('/match', payload).then((r) => r.data);

export const confirmRide = (rideId) =>
  client.post(`/rides/${rideId}/confirm`).then((r) => r.data);

export const completeRide = (rideId) =>
  client.post(`/rides/${rideId}/complete`).then((r) => r.data);

export const getRide = (rideId) =>
  client.get(`/rides/${rideId}`).then((r) => r.data);

export const getDetourQuote = (extraDistanceKm) =>
  client.post('/detour-quote', { extraDistanceKm }).then((r) => r.data);

export const sendRideMessage = (rideId, message) =>
  client.post(`/rides/${rideId}/messages`, message).then((r) => r.data);

export const getRideMessages = (rideId) =>
  client.get(`/rides/${rideId}/messages`).then((r) => r.data);

// ---- Live Tracking ----
export const lockOptimalRoute = (rideId, origin, destination) =>
  client.post('/tracking/lock-route', { rideId, origin, destination }).then((r) => r.data);

export const getLockedRoute = (rideId) =>
  client.get(`/tracking/route/${rideId}`).then((r) => r.data);

export const sendGpsPing = (rideId, lat, lng) =>
  client.post('/tracking/ping', { rideId, lat, lng }).then((r) => r.data);

// ---- Traffic & ETA ----
export const getTrafficEstimate = (origin, destination, elapsedMinutes = 0) =>
  client
    .get('/traffic/estimate', {
      params: {
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        elapsedMinutes,
      },
    })
    .then((r) => r.data);

// ---- Green Dashboard ----
export const recordRideForGreenDashboard = (payload) =>
  client.post('/green/record-ride', payload).then((r) => r.data);

export const getCo2Summary = (userId) =>
  client.get(`/green/summary/${userId}`).then((r) => r.data);

export const getEcoCoupons = (userId) =>
  client.get(`/green/coupons/${userId}`).then((r) => r.data);

export const redeemEcoCoupon = (userId, code) =>
  client.post(`/green/coupons/${userId}/redeem`, { code }).then((r) => r.data);

export const getDriverOfTheWeek = () =>
  client.get('/green/driver-of-the-week').then((r) => r.data);

// ---- Grievance Layer ----
export const fileGrievance = (payload) =>
  client.post('/grievance', payload).then((r) => r.data);

export const getGrievance = (ticketId) =>
  client.get(`/grievance/${ticketId}`).then((r) => r.data);

export const getGrievanceCountdown = (ticketId) =>
  client.get(`/grievance/${ticketId}/countdown`).then((r) => r.data);

export const getUserGrievances = (userId) =>
  client.get(`/grievance/user/${userId}`).then((r) => r.data);

export default client;
