# Vazhithunai — Integrator Module (Team Member 3)

Covers: Live Tracking, Traffic & ETA, Green Dashboard, Grievance Layer.

## Folder structure

```
vazhithunai-integrator/
├── backend/
│   ├── server.js                        # Express + Socket.io entry point
│   ├── config/mapConfig.js              # Map provider switch (Google/Mapbox/mock)
│   ├── utils/geoUtils.js                # Haversine distance, bearing, drift-from-route
│   ├── services/
│   │   ├── geoTrackingService.js        # Live Tracking: route lock + GPS ingestion
│   │   ├── trafficEtaService.js         # Traffic Factor + live ETA
│   │   ├── carbonFootprintService.js    # CO2 saved estimator
│   │   ├── ecoCouponService.js          # Eco-coupon generator + Driver of the Week
│   │   └── grievanceService.js          # Municipal Grievance Tracker
│   ├── models/                          # Plain-object shape references (Ride, Grievance, EcoCoupon)
│   ├── routes/                          # REST endpoints per feature
│   └── sockets/liveTrackingSocket.js    # Real-time GPS + ETA push
│
└── frontend/
    └── src/
        ├── services/api.js              # REST client for all 4 features
        ├── services/socket.js           # Socket.io client
        ├── hooks/useLiveLocation.js      # Live driver position + deviation flag
        ├── hooks/useTrafficETA.js        # Live traffic-aware ETA
        └── components/
            ├── LiveMap/                 # Feature 1: Live Tracking
            ├── ETADisplay/               # Feature 2: Traffic & ETA
            ├── GreenDashboard/           # Feature 3: Green Dashboard + eco-coupons
            └── GrievanceTracker/         # Feature 4: Grievance Layer
```

## Running it

**Backend**
```bash
cd backend
npm install
cp .env.example .env    # leave FORCE_MOCK_MODE=true for an offline demo
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Mock mode vs live APIs

Every Map/traffic call in `geoTrackingService.js` and `trafficEtaService.js`
checks `MOCK_MODE` from `config/mapConfig.js`. With no API key set (or
`FORCE_MOCK_MODE=true`), routes and traffic estimates are simulated
realistically — no internet/API key needed for the demo. To go live:

1. Get a Google Maps Platform key (Directions + Distance Matrix APIs) or a
   Mapbox token (Directions + Matrix APIs).
2. Set `MAP_PROVIDER`, `GOOGLE_MAPS_API_KEY`/`MAPBOX_ACCESS_TOKEN`, and
   `FORCE_MOCK_MODE=false` in `backend/.env`.
3. No other file changes needed — every service reads config from one place.

## How this maps to the pitch doc

- **Live Tracking** → `lockOptimalRoute()` implements Section 4's "locked at
  match time" principle; `ingestGpsPing()` feeds the "unrequested deviation
  flag" safety feature from Section 6.
- **Traffic & ETA** → `fetchTrafficEstimate()` is the same duration-in-traffic
  estimate the fare calculation (Section 4) is built on top of.
- **Green Dashboard** → `carbonFootprintService.js` implements the CO2-savings
  coupon mechanic and `ecoCouponService.js` the Driver of the Week leaderboard
  (Section 8).
- **Grievance Layer** → `grievanceService.js` implements the "transparent,
  trackable support desk" from Section 10 — every ticket gets a visible
  status and expected resolution time instead of a black box.

## Known gaps (be upfront about these in the demo)

- In-memory storage only — swap `Map()` stores in each service for a real
  DB before anything beyond the hackathon demo.
- Google polyline decoding is stubbed (returns origin/destination only) —
  add `@mapbox/polyline` or `@googlemaps/polyline-codec` for a real curved
  route when you flip off mock mode.
- CO2 emission factors are reasonable approximations, not measured data —
  worth a footnote on the slide if judges ask.
