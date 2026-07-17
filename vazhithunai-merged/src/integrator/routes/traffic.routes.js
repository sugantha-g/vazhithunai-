const express = require('express');
const router = express.Router();
const { fetchTrafficEstimate, toEtaPayload } = require('../services/trafficEtaService');

// GET /api/traffic/estimate?originLat=&originLng=&destLat=&destLng=&elapsedMinutes=
router.get('/estimate', async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng, elapsedMinutes } = req.query;
    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ error: 'originLat, originLng, destLat, destLng are required' });
    }
    const origin = { lat: parseFloat(originLat), lng: parseFloat(originLng) };
    const destination = { lat: parseFloat(destLat), lng: parseFloat(destLng) };

    const estimate = await fetchTrafficEstimate(origin, destination);
    const etaPayload = toEtaPayload(estimate, parseFloat(elapsedMinutes) || 0);
    res.json(etaPayload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
