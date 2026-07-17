/**
 * useLiveLocation.js
 * Subscribes to real-time GPS updates for a ride and exposes the driver's
 * current position plus any route-deviation safety flag.
 */

import { useEffect, useState } from 'react';
import socket from '../services/socket';

export function useLiveLocation(rideId) {
  const [position, setPosition] = useState(null);
  const [driftMeters, setDriftMeters] = useState(0);
  const [deviationFlagged, setDeviationFlagged] = useState(false);

  useEffect(() => {
    if (!rideId) return;

    socket.emit('ride:join', { rideId });

    const onGpsUpdate = (data) => {
      if (data.rideId !== rideId) return;
      setPosition(data.currentPosition);
      setDriftMeters(data.driftMeters);
      setDeviationFlagged(data.deviationFlagged);
    };

    socket.on('gps:update', onGpsUpdate);
    return () => socket.off('gps:update', onGpsUpdate);
  }, [rideId]);

  return { position, driftMeters, deviationFlagged };
}
