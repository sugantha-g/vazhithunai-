/**
 * GrievanceStatus.jsx
 * Feature: Grievance Layer
 * Polls the resolution countdown for a filed ticket so the user always
 * sees live status instead of submitting into a black box.
 */

import { useEffect, useState } from 'react';
import { getGrievance, getGrievanceCountdown } from '../../services/api';

const POLL_INTERVAL_MS = 30_000;

export default function GrievanceStatus({ ticketId }) {
  const [ticket, setTicket] = useState(null);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (!ticketId) return;

    let cancelled = false;
    const poll = () => {
      getGrievance(ticketId).then((t) => !cancelled && setTicket(t));
      getGrievanceCountdown(ticketId).then((c) => !cancelled && setCountdown(c));
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ticketId]);

  if (!ticket || !countdown) return <div>Loading ticket status…</div>;

  return (
    <div className="grievance-status">
      <h4>Ticket {ticket.ticketId}</h4>
      <p className={`grievance-status__badge grievance-status__badge--${ticket.status.replace(/\s+/g, '-').toLowerCase()}`}>
        {ticket.status}
      </p>
      {countdown.overdue ? (
        <p className="grievance-status__overdue">Past expected resolution — escalating</p>
      ) : (
        <p>Expected resolution in {countdown.remainingMinutes} min</p>
      )}

      <ul className="grievance-status__history">
        {ticket.history.map((h, i) => (
          <li key={i}>
            {new Date(h.at).toLocaleString()} — {h.status} {h.note && `(${h.note})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
