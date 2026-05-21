---
# Cloudflare Tunnel Setup (Demo Day)

Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

Two tunnels are needed:
  Tunnel A: exposes the backend (port 3001) so the ambulance phone can hit the API
  Tunnel B: exposes the frontend (port 5173) so judges can see the dashboards

## Run on demo day (no account needed — quick tunnels)

Terminal 1 (Tunnel A — backend):
  cloudflared tunnel --url http://localhost:3001

Terminal 2 (Tunnel B — frontend):
  cloudflared tunnel --url http://localhost:5173

Each command prints a public URL like:
  https://something-random.trycloudflare.com

## After you have the Tunnel A URL

Update pars/Frontend/.env.local (create it if needed):
  VITE_API_URL=https://<tunnel-a-url>

Then update every API fetch in the Frontend to use:
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

Files to update (search for http://localhost:3001):
  src/pages/DispatcherPage.jsx       — const API = ...
  src/pages/HospitalPage.jsx         — all fetch() calls
  src/pages/AmbulancePage.jsx        — all fetch() + io() calls
  src/pages/AmbulanceSessionPage.jsx — fetch() + io()
  src/pages/HISPage.jsx              — const API = ...
  src/components/LiveMap.jsx         — n/a (no fetch)

Replace every hardcoded 'http://localhost:3001' with:
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
and use that constant. (DispatcherPage and HISPage already have const API,
the others need it added.)

## Socket.IO on tunnel

Socket.IO over Cloudflare quick tunnels works with HTTP long-polling.
WebSockets may be blocked by the proxy. Force polling in every io() call:

  io(API, {
    transports: ['polling'],   // add this line
    auth: { token }
  })

If WebSockets are confirmed to work, remove the transports override.
---
