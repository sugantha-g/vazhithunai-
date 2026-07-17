const express = require('express');
const router = express.Router();
const {
  lockOptimalRoute,
  getLockedRoute,
  ingestGpsPing,
  getLiveTelemetry,
} = require('../services/geoTrackingService');

// POST /api/tracking/lock-route
// Body: { rideId, origin: {lat,lng}, destination: {lat,lng} }
router.post('/lock-route', async (req, res) => {
  try {
    const { rideId, origin, destination } = req.body;
    if (!rideId || !origin || !destination) {
      return res.status(400).json({ error: 'rideId, origin, and destination are required' });
    }
    const route = await lockOptimalRoute(rideId, origin, destination);
    res.status(201).json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tracking/route/:rideId
router.get('/route/:rideId', (req, res) => {
  const route = getLockedRoute(req.params.rideId);
  if (!route) return res.status(404).json({ error: 'No locked route for this ride' });
  res.json(route);
});

// POST /api/tracking/ping
// Body: { rideId, lat, lng }
// Also used by sockets/liveTrackingSocket.js for the real-time stream —
// this REST endpoint exists for clients/tests that aren't on a socket.
router.post('/ping', (req, res) => {
  try {
    const { rideId, lat, lng } = req.body;
    const result = ingestGpsPing(rideId, { lat, lng });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/tracking/history/:rideId
router.get('/history/:rideId', (req, res) => {
  res.json(getLiveTelemetry(req.params.rideId));
});

module.exports = router;
