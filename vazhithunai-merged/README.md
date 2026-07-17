# Vazhithunai — merged prototype

This folder merges the two previously-separate builds into one runnable
prototype:

- **App backend** (matching, fare lock/split, in-app chat, trust score/DB)
  — originally `vazhithunai-app`
- **Integrator backend** (live tracking, traffic/ETA, green dashboard,
  grievance layer) — originally `vazhithunai-integrator/backend`
- **Frontend** (React/Vite) — originally `vazhithunai-integrator/frontend`,
  extended with a booking panel and chat so it drives a real ride instead
  of hardcoded demo IDs.

## What actually changed to make this a merge, not just two folders side by side

1. **One process, one port (3001).** `server.js` is the single entry point.
   It's ESM, but `src/integrator/` carries its own `package.json` with
   `{ "type": "commonjs" }`, so Node loads that subtree with CommonJS
   semantics while the rest of the app stays ESM. `createRequire()` bridges
   the two inside `server.js`.
2. **Shared `rideId`.** `POST /api/match` (app backend) now also calls
   the integrator's `lockOptimalRoute()` directly, in-process, using the
   *same* ride id — so the live map, ETA, and fare are all describing one
   ride, not two unrelated ones.
3. **Ride completion feeds the Green Dashboard.** `POST /api/rides/:id/complete`
   now also calls the integrator's CO2 + eco-coupon services for every
   rider on that ride, using the same `riderLegs` the fare split already
   computed.
4. **One frontend origin.** `frontend/.env` points at `:3001` for both
   REST calls and the Socket.io connection — no more juggling two API
   base URLs.

Everything else (the matching algorithm, fare formula, chat redaction,
trust score, live GPS ingestion, traffic estimate, CO2 model, grievance
tracker) is unchanged from the original two projects — only the seams
between them were built.

## Running it

**Backend** (matching + fare + chat + trust + tracking + traffic + green + grievance, all on :3001):
```bash
npm install
cp .env.example .env    # defaults run fully offline: in-memory DB + mock maps
npm start
```
This also seeds a demo rider/driver so the frontend has something to show
immediately (mirrors the original `seedDemoData()` from the app backend).

Verify it's alive:
```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/me
```

**Frontend** (React, :5173):
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Open http://localhost:5173, click **Find nearby mates** — that calls
`/api/match`, which locks the fare *and* the route under one ride id, and
the Live Tracking / ETA / Chat panels below light up using that same id.

## Going live (optional, not needed for the demo)

- **Real Firestore**: drop a `serviceAccountKey.json` in the project root,
  set `USE_REAL_FIREBASE=true` in `.env`.
- **Real maps/traffic**: set `MAP_PROVIDER`, `GOOGLE_MAPS_API_KEY` or
  `MAPBOX_ACCESS_TOKEN`, and `FORCE_MOCK_MODE=false` in `.env`.
- No other code changes needed for either — both were already built
  behind a single config switch in the original modules.

## What's still rough (be upfront about these)

- In-memory storage in the integrator services (`Map()`) — fine for a
  demo, swap for a real DB before anything beyond the hackathon.
- `PICKUP_COORDS` in `server.js` is a hardcoded lookup for the demo
  dropdown — replace with real geocoding.
- Only one demo rider is in the matched group in the current frontend
  flow, so the CO2 saving on ride completion shows 0 (the model only
  credits savings when `groupSize > 1`) — this is correct behavior, not
  a bug; add a second simultaneous rider request to see a nonzero saving.
- Google polyline decoding is stubbed to `[origin, destination]` in
  `geoTrackingService.js` — fine in mock mode, needs a real decoder
  (`@mapbox/polyline` or `@googlemaps/polyline-codec`) once live maps are
  switched on.

## Original module docs

Kept for reference — the module-level implementation notes still apply
unchanged:
- `README-app-backend.md` — matching/fare/chat/DB details
- `README-integrator-frontend.md` — tracking/traffic/green/grievance details
