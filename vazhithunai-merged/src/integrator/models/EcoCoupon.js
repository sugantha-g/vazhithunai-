/**
 * EcoCoupon.js
 * Shape reference for an issued eco-coupon. See services/ecoCouponService.js.
 */
class EcoCoupon {
  constructor({ code, userId, milestoneKg, issuedAt, redeemed }) {
    this.code = code;
    this.userId = userId;
    this.milestoneKg = milestoneKg;
    this.issuedAt = issuedAt;
    this.redeemed = redeemed;
  }
}

module.exports = EcoCoupon;
