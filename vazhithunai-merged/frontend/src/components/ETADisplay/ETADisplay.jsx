/**
 * ETADisplay.jsx
 * Feature: Traffic & ETA
 * Shows the traffic-aware ETA and a plain-language reason when it shifts
 * (mirrors the pitch's "transparent surge/traffic explanation" principle —
 * never a black-box number).
 */

import { useTrafficETA } from '../../hooks/useTrafficETA';

export default function ETADisplay({ rideId, origin, destination }) {
  const { eta, loading } = useTrafficETA(rideId, origin, destination);

  if (loading || !eta) {
    return <div className="eta-display eta-display--loading">Calculating ETA…</div>;
  }

  const arrivalTime = new Date(eta.etaClockTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="eta-display">
      <div className="eta-display__headline">
        Arriving by <strong>{arrivalTime}</strong> · {eta.remainingMinutes} min
      </div>
      <div className="eta-display__detail">
        {eta.distanceKm} km · Traffic factor {eta.trafficFactor}x · {eta.reason}
      </div>
    </div>
  );
}
