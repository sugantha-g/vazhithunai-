# Deploying Vazhithunai (Render + Vercel)

This app has two parts that deploy separately:
- **Backend** (Express + Socket.io, `server.js`) → Render
- **Frontend** (React/Vite, `frontend/`) → Vercel

Both run fully in mock mode by default — no API keys required for a working demo.

## 1. Push to GitHub
Deploys work best from a git repo. If you haven't already:
```bash
cd vazhithunai-merged
git init
git add .
git commit -m "Vazhithunai merged prototype"
```
Create a repo on GitHub and push it there.

## 2. Deploy the backend on Render
1. Go to https://render.com, sign in with GitHub.
2. **New +** → **Web Service** → connect your repo.
3. Render should auto-detect `render.yaml` in the repo root (already included)
   and pre-fill the settings. If not, set manually:
   - **Root Directory**: (leave blank — repo root)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. Click **Create Web Service**. Wait for the build to finish.
5. Once live, note your URL, e.g. `https://vazhithunai-backend.onrender.com`.
6. Verify it: visit `https://<your-render-url>/health` — should return
   `{"status":"ok","merged":true}`.

Note: Render's free tier spins the service down after ~15 min of no traffic
and takes ~30–60s to wake back up on the next request. Fine for a demo, not
for production traffic.

## 3. Deploy the frontend on Vercel
1. Go to https://vercel.com, sign in with GitHub.
2. **Add New** → **Project** → import the same repo.
3. Set **Root Directory** to `frontend` (important — the frontend is a
   subfolder, not the repo root).
4. Vercel auto-detects Vite; the included `vercel.json` handles routing.
5. Add environment variables (Project Settings → Environment Variables):
   - `VITE_API_BASE_URL` = `https://<your-render-url>/api`
   - `VITE_SOCKET_URL` = `https://<your-render-url>`
6. Deploy. Vercel gives you a URL like `https://vazhithunai.vercel.app`.

## 4. Sanity check
Open your Vercel URL, click **Find nearby mates**. If the live map/chat panels
don't light up, open browser dev tools → Network tab and confirm requests are
hitting your Render URL (not localhost) and returning 200s.

## Going further (optional)
- Real Firestore: add `USE_REAL_FIREBASE=true` + upload `serviceAccountKey.json`
  as a Render secret file, or convert it to individual env vars.
- Real maps/traffic: set `GOOGLE_MAPS_API_KEY` (or `MAPBOX_ACCESS_TOKEN`) and
  `FORCE_MOCK_MODE=false` as Render env vars.
- Swap Render's free plan for a paid one to avoid cold-start spin-down.
