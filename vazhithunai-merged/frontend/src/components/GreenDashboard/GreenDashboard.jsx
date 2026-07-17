/**
 * GreenDashboard.jsx
 * Feature: The Green Dashboard
 * Shows a rider's lifetime CO2 saved + their earned eco-coupons, and the
 * "Driver of the Week" leaderboard (Section 8 of the pitch).
 */

import { useEffect, useState } from 'react';
import { getCo2Summary, getEcoCoupons, getDriverOfTheWeek } from '../../services/api';
import EcoCouponCard from './EcoCouponCard';

export default function GreenDashboard({ userId }) {
  const [summary, setSummary] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    if (!userId) return;
    getCo2Summary(userId).then(setSummary);
    getEcoCoupons(userId).then(setCoupons);
    getDriverOfTheWeek().then(setLeaderboard);
  }, [userId]);

  if (!summary) return <div>Loading your Green Dashboard…</div>;

  return (
    <div className="green-dashboard">
      <section className="green-dashboard__stats">
        <h3>Your Impact</h3>
        <p>
          <strong>{summary.totalKgSaved} kg</strong> CO₂ saved across{' '}
          <strong>{summary.rideCount}</strong> shared rides
        </p>
        <p className="green-dashboard__fun-stat">
          ≈ {summary.treesEquivalent} trees' worth of annual CO₂ absorption
        </p>
      </section>

      <section className="green-dashboard__coupons">
        <h3>Eco-Coupons Earned</h3>
        {coupons.length === 0 && <p>Share more rides to unlock your first eco-coupon.</p>}
        <div className="green-dashboard__coupon-grid">
          {coupons.map((c) => (
            <EcoCouponCard key={c.code} coupon={c} userId={userId} />
          ))}
        </div>
      </section>

      <section className="green-dashboard__leaderboard">
        <h3>Driver of the Week</h3>
        <ol>
          {leaderboard.map((d) => (
            <li key={d.driverId}>
              {d.name} — {d.ridesCompleted} rides · {d.co2SavedKg.toFixed(1)} kg CO₂ saved
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
