/**
 * GrievanceForm.jsx
 * Feature: Grievance Layer
 * Lets a rider file a complaint/safety report and immediately shows the
 * ticket ID + expected resolution time — the "transparent, trackable
 * support desk" from Section 10, no black-box submission.
 */

import { useState } from 'react';
import { fileGrievance } from '../../services/api';

const CATEGORIES = [
  { value: 'safety', label: 'Safety concern' },
  { value: 'fare_dispute', label: 'Fare dispute' },
  { value: 'driver_behavior', label: 'Driver behavior' },
  { value: 'app_bug', label: 'App issue' },
  { value: 'other', label: 'Other' },
];

export default function GrievanceForm({ userId, rideId, onFiled }) {
  const [category, setCategory] = useState('safety');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const record = await fileGrievance({ userId, rideId, category, description });
      setTicket(record);
      onFiled?.(record);
    } finally {
      setSubmitting(false);
    }
  };

  if (ticket) {
    const slaTime = new Date(ticket.expectedResolutionBy).toLocaleString();
    return (
      <div className="grievance-form__confirmation">
        <p>Ticket filed: <strong>{ticket.ticketId}</strong></p>
        <p>Expected resolution by: {slaTime}</p>
      </div>
    );
  }

  return (
    <form className="grievance-form" onSubmit={handleSubmit}>
      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>

      <label>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened?"
          rows={4}
          required
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Submitting…' : 'File Report'}
      </button>
    </form>
  );
}
