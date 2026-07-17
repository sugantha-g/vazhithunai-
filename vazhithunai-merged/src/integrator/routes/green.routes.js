const express = require('express');
const router = express.Router();
const { recordRideSaving, getUserCo2Summary } = require('../services/carbonFootprintService');
const {
  checkAndIssueCoupon,
  getCouponsForUser,
  redeemCoupon,
  recordDriverRide,
  getDriverOfTheWeekBoard,
} = require('../services/ecoCouponService');

// POST /api/green/record-ride
// Body: { userId, distanceKm, groupSize, driverId, driverName }
// Call this once a ride completes — updates CO2 ledger, checks for new
// coupons, and updates the driver leaderboard in one pass.
router.post('/record-ride', (req, res) => {
  try {
    const { userId, distanceKm, groupSize, driverId, driverName } = req.body;
    if (!userId || distanceKm == null || !groupSize) {
      return res.status(400).json({ error: 'userId, distanceKm, and groupSize are required' });
    }

    const { savedGramsThisRide } = recordRideSaving(userId, distanceKm, groupSize);
    const summary = getUserCo2Summary(userId);
    const newCoupons = checkAndIssueCoupon(userId, summary.totalKgSaved);

    if (driverId) {
      recordDriverRide(driverId, driverName || 'Driver', savedGramsThisRide / 1000);
    }

    res.json({ savedGramsThisRide, summary, newCoupons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/green/summary/:userId
router.get('/summary/:userId', (req, res) => {
  res.json(getUserCo2Summary(req.params.userId));
});

// GET /api/green/coupons/:userId
router.get('/coupons/:userId', (req, res) => {
  res.json(getCouponsForUser(req.params.userId));
});

// POST /api/green/coupons/:userId/redeem
// Body: { code }
router.post('/coupons/:userId/redeem', (req, res) => {
  try {
    const coupon = redeemCoupon(req.params.userId, req.body.code);
    res.json(coupon);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/green/driver-of-the-week
router.get('/driver-of-the-week', (req, res) => {
  res.json(getDriverOfTheWeekBoard());
});

module.exports = router;
