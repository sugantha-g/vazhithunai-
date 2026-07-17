const express = require('express');
const router = express.Router();
const {
  fileGrievance,
  getGrievance,
  getGrievancesForUser,
  updateGrievanceStatus,
  getResolutionCountdown,
} = require('../services/grievanceService');

// POST /api/grievance
// Body: { userId, rideId, category, description, location }
router.post('/', (req, res) => {
  try {
    const record = fileGrievance(req.body);
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/grievance/:ticketId
router.get('/:ticketId', (req, res) => {
  try {
    res.json(getGrievance(req.params.ticketId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/grievance/user/:userId
router.get('/user/:userId', (req, res) => {
  res.json(getGrievancesForUser(req.params.userId));
});

// GET /api/grievance/:ticketId/countdown
router.get('/:ticketId/countdown', (req, res) => {
  try {
    res.json(getResolutionCountdown(req.params.ticketId));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// PATCH /api/grievance/:ticketId/status  (admin/support use)
// Body: { status, note }
router.patch('/:ticketId/status', (req, res) => {
  try {
    const record = updateGrievanceStatus(req.params.ticketId, req.body.status, req.body.note);
    res.json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
