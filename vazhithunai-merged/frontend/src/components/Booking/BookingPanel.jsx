/**
 * BookingPanel.jsx
 * NEW — the missing piece that ties the two halves of Vazhithunai
 * together in the UI. Calls the app backend's /api/match, shows the
 * locked + split fare, and hands the resulting rideId up to the parent
 * so LiveMap / ETADisplay / GreenDashboard / Grievance all point at the
 * SAME ride instead of a hardcoded demo id.
 */

import { useState } from 'react';
import { requestMatch, confirmRide, completeRide } from '../../services/api';

export default function BookingPanel({ onRideChange }) {
  const [ride, setRide] = useState(null);
  const [surge, setSurge] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleFindMatch() {
    setLoading(true);
    setError(null);
    try {
      const result = await requestMatch({ pickupKey: 'guindy' });
      setRide(result.ride);
      setSurge(result.surgeExplanation);
      onRideChange?.(result.ride.id);
    } catch (err) {
      setError(err.message || 'Could not find a match');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    const { ride: updated } = await confirmRide(ride.id);
    setRide(updated);
  }

  async function handleComplete() {
    const { ride: updated, green } = await completeRide(ride.id);
    setRide(updated);
    if (green?.length) {
      console.log('Green dashboard updated for this ride:', green);
    }
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
      {!ride && (
        <button onClick={handleFindMatch} disabled={loading}>
          {loading ? 'Finding a match…' : 'Find nearby mates'}
        </button>
      )}

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {ride && (
        <div>
          <p>
            Ride <code>{ride.id}</code> — status: <strong>{ride.status}</strong>
          </p>
          <p>Locked fare: ₹{ride.lockedFare}</p>
          <ul>
            {(ride.riderLegs || []).map((leg) => (
              <li key={leg.riderId}>
                Rider {leg.riderId.slice(-4)} — {leg.distanceKm.toFixed(2)} km — ₹{leg.fareShare ?? '—'}
              </li>
            ))}
          </ul>
          {surge && <p style={{ fontSize: 13, color: '#666' }}>{surge}</p>}

          {ride.status === 'locked' && <button onClick={handleConfirm}>Start ride</button>}
          {ride.status === 'in_progress' && <button onClick={handleComplete}>Complete ride</button>}
          {ride.status === 'completed' && <p>Ride complete — check the Green Dashboard below.</p>}
        </div>
      )}
    </div>
  );
}
