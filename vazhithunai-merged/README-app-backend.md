# Vazhithunai Backend — Architect Role (Backend & Matching Logic)

Covers all four tasks assigned to this role:

| Task | File |
|---|---|
| Matching Algorithm | `src/matching/matchingEngine.js` |
| Fair-Split Calculator | `src/pricing/fareCalculator.js` |
| Privacy Chat | `src/chat/chatService.js` |
| Database | `src/db/models.js` + `src/db/firestore.js` |

## Quick start

```bash
npm install
npm run demo
```

Runs an end-to-end scenario: two riders get matched near a metro stop, the group's fare
gets locked and split by distance, a detour surcharge is calculated, they chat (phone
numbers auto-redacted), and post-ride reviews feed into a trust score.

**No Firebase setup needed to demo.** `src/db/firestore.js` auto-falls-back to an
in-memory mock store that mimics the Firestore API used here, so the whole stack runs
standalone. To point it at real Firestore for the actual build:

1. Generate a service account key from the Firebase console → save as `serviceAccountKey.json` in the project root.
2. Run with `USE_REAL_FIREBASE=true npm start`.

No other code changes needed — every module talks to `db` through the same interface either way.

## Module details

### 1. Matching Algorithm (`matching/matchingEngine.js`)
- Haversine distance + compass bearing between pickup/dropoff pairs.
- Groups riders within a live ~200m radius heading the same direction (±35°).
- **Must-Reach-By check**: before adding a rider to a group, estimates the extra
  detour time (via `estimateDetourMinutes`) and rejects the match if it would push
  *any* current group member — or the candidate themselves — past their deadline.
  Swap `estimateDetourMinutes`'s simple speed model for a real routing API call
  (e.g. Google Directions duration-in-traffic) when you're ready.
- Respects vehicle capacity (4 for auto, 6-7 for cab) and tags groups formed near a
  known transit stop as `metroFeederTag`.

### 2. Fair-Split Calculator (`pricing/fareCalculator.js`)
- `TARIFF` holds the government per-km rate — update to the current published rate.
- `lockGroupFare()` — call **once**, when a group is confirmed. Applies a dampened
  traffic-index adjustment plus off-peak discount / surge, and returns a fare that
  should be persisted and never recalculated (Section 4: "no surprise increase mid-ride").
- `splitFareByDistance()` — splits the locked total proportionally to each rider's own
  leg distance.
- `calculateDetourSurcharge()` — same per-km formula, charged only to the rider who
  requested the detour, paid straight to the driver.
- `suggestExactChange()` — denomination breakdown for cash payers.

### 3. Privacy Chat (`chat/chatService.js`)
- Messages are scoped to a `rideId`; sender identity shown as `"Rider 1"` / `"Driver"`,
  never real phone numbers.
- `redactPhoneNumbers()` strips anything phone-shaped from message text as a second
  layer of defense, independent of the fact that phone fields are never exposed to
  the client in the first place.
- `subscribeToMessages()` gives a simple polling-based live update hook that works
  identically against the mock and real Firestore — swap for a native `onSnapshot`
  listener in production for lower latency.

### 4. Database (`db/models.js`, `db/firestore.js`)
- **users** — rider records, ID verification flag, gender preference (only meaningful
  for female users, per Section 6), age preference.
- **drivers** — verified driver records, vehicle type/capacity, Beckn provider ID slot.
- **rides** — the ride state machine (`matching → locked → in_progress → completed/cancelled`),
  holding the locked fare and per-rider legs.
- **reviews** + `getTrustScore()` — threshold-based trust score: % positive over the
  most recent N rides (default 20), *not* a raw star average — resistant to a single
  outlier swinging the number.
- **connections** + `addConnection()` — Instagram-style, one-directional "add," locked
  to pairs who've actually completed a ride together (closes the spam/fake-add vector).
  Purely a social display signal — never feeds the trust score itself.

## Next steps for integration
- Swap `estimateDetourMinutes` for a real routing API call once a key is available.
- Wire `matchRider()` into whatever real-time layer the frontend polls or subscribes to
  (e.g. a Firestore `rides` listener, or a lightweight WebSocket layer on top of this).
- Hand off `driverId` + `riderLegs` + `lockedFare` to the Beckn dispatch handoff step
  once a group's status flips to `"locked"`.
