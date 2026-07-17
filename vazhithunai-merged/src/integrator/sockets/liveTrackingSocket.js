/**
 * liveTrackingSocket.js
 * Real-time channel for the Live Tracking + Traffic/ETA features.
 * Driver app emits 'gps:ping' every few seconds; every rider in that ride's
 * room gets 'gps:update' (position + deviation flag) and a periodic
 * 'eta:update' pushed back.
 */

const { ingestGpsPing, getLockedRoute } = require('../services/geoTrackingService');
const { fetchTrafficEstimate, toEtaPayload } = require('../services/trafficEtaService');

function registerLiveTrackingSocket(io) {
  io.on('connection', (socket) => {
    // Driver or rider joins the room for a specific ride
    socket.on('ride:join', ({ rideId }) => {
      socket.join(rideId);
    });

    // Driver's device streams GPS pings
    socket.on('gps:ping', async ({ rideId, lat, lng }) => {
      try {
        const result = ingestGpsPing(rideId, { lat, lng });
        io.to(rideId).emit('gps:update', result);

        if (result.deviationFlagged) {
          // Feeds the "unrequested deviation flag" safety feature
          io.to(rideId).emit('safety:deviation-flagged', {
            rideId,
            driftMeters: result.driftMeters,
            at: new Date().toISOString(),
          });
        }

        // Recompute ETA against current position -> destination
        const route = getLockedRoute(rideId);
        if (route) {
          const estimate = await fetchTrafficEstimate({ lat, lng }, route.destination);
          const etaPayload = toEtaPayload(estimate);
          io.to(rideId).emit('eta:update', etaPayload);
        }
      } catch (err) {
        socket.emit('tracking:error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      // no-op for the demo; add cleanup/logging here if needed
    });
  });
}

module.exports = registerLiveTrackingSocket;
