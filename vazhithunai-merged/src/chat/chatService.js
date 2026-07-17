// src/chat/chatService.js
//
// "Privacy Chat" — Section 6: riders and drivers coordinate ("running 2
// minutes late, wait for me") without ever exchanging phone numbers.
// Messages are scoped strictly to a rideId; no participant identity beyond
// display name + role is ever exposed to the other side.

import { db } from "../db/firestore.js";

const PHONE_PATTERN = /(\+?\d[\d\s-]{7,}\d)/g;

/**
 * Strips anything that looks like a phone number before a message is
 * stored/sent — defense in depth on top of simply never surfacing the
 * real phone field to the client.
 */
export function redactPhoneNumbers(text) {
  return text.replace(PHONE_PATTERN, "[number removed]");
}

/**
 * @param {string} rideId
 * @param {{ senderId: string, senderRole: "rider"|"driver", senderDisplayName: string, text: string }} message
 */
export async function sendMessage(rideId, message) {
  const safeText = redactPhoneNumbers(message.text);

  const record = {
    rideId,
    senderId: message.senderId,
    senderRole: message.senderRole,
    senderDisplayName: message.senderDisplayName, // "Rider 1", "Driver", never phone/full legal name
    text: safeText,
    sentAt: Date.now(),
  };

  const ref = await db.collection("messages").add(record);
  return { id: ref.id, ...record };
}

/**
 * Fetches the chat thread for a ride, oldest first. In the in-memory demo
 * DB this is a simple filter+sort; on real Firestore this should be
 * swapped for an indexed `where("rideId","==",rideId).orderBy("sentAt")`
 * query for production scale.
 */
export async function getMessages(rideId) {
  const all = await db.collection("messages").listAll();
  return all
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => m.rideId === rideId)
    .sort((a, b) => a.sentAt - b.sentAt);
}

/**
 * Lightweight polling subscription — works identically against the
 * in-memory mock and real Firestore, so the demo and production behave
 * the same way. For a production build with real Firestore, prefer a
 * native onSnapshot listener instead of polling for lower latency.
 *
 * @returns {() => void} unsubscribe function
 */
export function subscribeToMessages(rideId, onUpdate, pollIntervalMs = 2000) {
  let lastCount = 0;
  const interval = setInterval(async () => {
    const messages = await getMessages(rideId);
    if (messages.length !== lastCount) {
      lastCount = messages.length;
      onUpdate(messages);
    }
  }, pollIntervalMs);

  return () => clearInterval(interval);
}
