/**
 * EcoCouponCard.jsx
 * Single eco-coupon tile with a redeem button. Kept as its own component
 * since it's re-used in both the Green Dashboard and (later) a checkout flow.
 */

import { useState } from 'react';
import { redeemEcoCoupon } from '../../services/api';

export default function EcoCouponCard({ coupon, userId }) {
  const [redeemed, setRedeemed] = useState(coupon.redeemed);
  const [error, setError] = useState(null);

  const handleRedeem = async () => {
    try {
      await redeemEcoCoupon(userId, coupon.code);
      setRedeemed(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not redeem coupon');
    }
  };

  return (
    <div className={`eco-coupon-card ${redeemed ? 'eco-coupon-card--redeemed' : ''}`}>
      <div className="eco-coupon-card__milestone">{coupon.milestoneKg} kg milestone</div>
      <div className="eco-coupon-card__code">{coupon.code}</div>
      {redeemed ? (
        <span className="eco-coupon-card__status">Redeemed</span>
      ) : (
        <button onClick={handleRedeem}>Redeem</button>
      )}
      {error && <p className="eco-coupon-card__error">{error}</p>}
    </div>
  );
}
