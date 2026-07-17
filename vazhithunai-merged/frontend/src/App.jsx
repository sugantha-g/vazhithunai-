/**
 * App.jsx
 * Merged demo shell. The booking flow (match -> fare -> confirm ->
 * complete) drives a single rideId that now feeds LiveMap, ETADisplay,
 * RideChat, and GreenDashboard -- previously these were hardcoded demo
 * constants with no real ride behind them.
 */

import { useState } from 'react';
import BookingPanel from './components/Booking/BookingPanel';
import RideChat from './components/Chat/RideChat';
import LiveMap from './components/LiveMap/LiveMap';
import ETADisplay from './components/ETADisplay/ETADisplay';
import GreenDashboard from './components/GreenDashboard/GreenDashboard';
import GrievanceForm from './components/GrievanceTracker/GrievanceForm';
import GrievanceStatus from './components/GrievanceTracker/GrievanceStatus';

// Demo user id -- matches the seeded demo rider created in server.js.
// Replace with real auth/session once that's wired up.
const DEMO_USER_ID = 'user-demo-001';
const DEMO_ORIGIN = { lat: 13.0067, lng: 80.2206 }; // Guindy
const DEMO_DESTINATION = { lat: 13.0067, lng: 80.2276 };

export default function App() {
  const [rideId, setRideId] = useState(null);
  const [activeTicket, setActiveTicket] = useState(null);

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h2>Book a ride</h2>
      <BookingPanel onRideChange={setRideId} />

      {rideId && (
        <>
          <h2>Live Tracking</h2>
          <LiveMap rideId={rideId} />

          <h2>Traffic &amp; ETA</h2>
          <ETADisplay rideId={rideId} origin={DEMO_ORIGIN} destination={DEMO_DESTINATION} />

          <h2>Chat</h2>
          <RideChat rideId={rideId} senderId={DEMO_USER_ID} />
        </>
      )}

      <h2>Green Dashboard</h2>
      <GreenDashboard userId={DEMO_USER_ID} />

      <h2>Grievance Layer</h2>
      {activeTicket ? (
        <GrievanceStatus ticketId={activeTicket.ticketId} />
      ) : (
        <GrievanceForm
          userId={DEMO_USER_ID}
          rideId={rideId || 'ride-demo-001'}
          onFiled={setActiveTicket}
        />
      )}
    </div>
  );
}
