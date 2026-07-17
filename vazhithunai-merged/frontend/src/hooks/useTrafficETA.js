/**
 * useTrafficETA.js
 * Subscribes to real-time ETA recalculations pushed whenever the driver's
 * GPS updates. Falls back to a one-off REST fetch on mount so the UI has
 * an ETA to show before the first socket push arrives.
 */

import { useEffect, useState } from 'react';
import socket from '../services/socket';
import { getTrafficEstimate } from '../services/api';

export function useTrafficETA(rideId, origin, destination) {
  const [eta, setEta] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initial fetch so the UI isn't empty while waiting for the first GPS ping
  useEffect(() => {
    if (!origin || !destination) return;
    setLoading(true);
    getTrafficEstimate(origin, destination)
      .then(setEta)
      .finally(() => setLoading(false));
  }, [origin, destination]);

  // Live updates as the ride progresses
  useEffect(() => {
    if (!rideId) return;

    const onEtaUpdate = (data) => {
      setEta(data);
      setLoading(false);
    };

    socket.on('eta:update', onEtaUpdate);
    return () => socket.off('eta:update', onEtaUpdate);
  }, [rideId]);

  return { eta, loading };
}
