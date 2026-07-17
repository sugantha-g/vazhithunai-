/**
 * RideChat.jsx
 * NEW — simple polling chat panel for the in-ride chat service
 * (src/chat/chatService.js on the app backend). Phone numbers are
 * redacted server-side before messages ever reach this component.
 */

import { useEffect, useState } from 'react';
import { sendRideMessage, getRideMessages } from '../../services/api';

export default function RideChat({ rideId, senderId, senderRole = 'rider', senderDisplayName = 'Rider 1' }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!rideId) return;
    let cancelled = false;

    async function poll() {
      const { messages: msgs } = await getRideMessages(rideId);
      if (!cancelled) setMessages(msgs);
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rideId]);

  async function handleSend() {
    if (!text.trim()) return;
    await sendRideMessage(rideId, { senderId, senderRole, senderDisplayName, text });
    setText('');
  }

  if (!rideId) return null;

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginTop: 12 }}>
      <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.senderDisplayName}:</strong> {m.text}
          </div>
        ))}
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder="Message the driver (no phone numbers)"
        style={{ width: '70%' }}
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
