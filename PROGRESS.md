# pars/ — Progress Log

This is the activity trail for everything that ships out of `pars/`.
Append a new line for every meaningful change so the orchestrator can
roll back when something breaks.

---

## Status snapshot (2026-04-10)

### ✅ Backend
- [x] JWT auth (bcrypt + 24h tokens) — `controllers/authController.js`
- [x] Category classifier (rule-based, 9 categories) — `services/categoryClassifier.js`
- [x] Hospital schema with `categoryCapabilities`, `categoryTiers`, `load`, `teamsOnCall`, `capacity` — `models/hospital.js`
- [x] Incident schema with `category`, `categoryConfidence`, `hospitalRecommendations`, `preAlertSentAt`, `handoverCompletedAt` — `models/incident.js`
- [x] Hospital ranker with transparent `reasons[]` — `services/hospitalService.js`
- [x] Dispatch service: assign, rank ambulances, reroute — `services/dispatchService.js`
- [x] Dispatch controller: queue, active, hospitals, recommendations, pre-alert, reroute, status — `controllers/dispatchController.js`
- [x] Dispatch routes — `routes/dispatchRoutes.js`
- [x] Reroute trigger on ESI worsening (`case:reroute_suggested`) — `services/riskScheduler.js`
- [x] Seed: 3 RVITM hospitals (Apollo, Fortis, RV Community), 3 ambulances, 4 demo users — `seed.js`
- [x] Port standardised on 3001 across backend + frontend
- [x] `.env.example`

### ✅ Frontend
- [x] Dispatcher page rewritten: category badges, ranked recs (hospitals + units), inline assign, in-flight panel, pre-alert + reroute buttons, reroute banner, live Leaflet map — `pages/DispatcherPage.jsx`
- [x] LiveMap component (vanilla Leaflet, no react-leaflet) — `components/LiveMap.jsx`
- [x] Hospital page: pre-alert cards with category color, team activations, accept-handover button — `pages/HospitalPage.jsx`
- [x] Ambulance page: tabbed UI (Driver / Paramedic), GPS toggle, status push buttons — `pages/AmbulancePage.jsx`
- [x] HIS page: retro green bed-board, per-hospital tiles, real-time incoming feed — `pages/HISPage.jsx`
- [x] HIS route registered in `App.jsx` and nav

### ✅ ML
- (unchanged) XGBoost ESI predictor on Flask `:8000` — `pars/Ml/models/connection.py`

### ✅ Top-level docs (re-aligned to PARS-as-base shape)
- [x] `ARCHITECTURE.md` rewritten
- [x] `HARDCODED_VS_REAL.md` rewritten
- [x] `DEMO_SCRIPT.md` rewritten
- [x] `README.md` rewritten

### Pending / known gaps
- [x] Smoke test the full flow end-to-end on a real device
- [ ] Confirm Cloudflare tunnel setup with both Backend and Frontend
- [ ] Run `npm install` in `pars/Frontend` to pick up the new `leaflet` dep
- [ ] Decide whether to scripted-trigger the reroute via a "worsen vitals" demo button

---

## Activity log

| When | Who | What |
|---|---|---|
| 2026-04-10 | orchestrator (Claude) | Adopted PARS as base, moved to `pars/` (clean path) |
| 2026-04-10 | orchestrator (Claude) | Fixed port mismatch (5050 → 3001) across 11 files |
| 2026-04-10 | orchestrator (Claude) | Extended Hospital + Incident schemas for category-aware routing |
| 2026-04-10 | orchestrator (Claude) | Added rule-based category classifier with 9 categories |
| 2026-04-10 | orchestrator (Claude) | Rewrote `hospitalService` with transparent `reasons[]` |
| 2026-04-10 | orchestrator (Claude) | Added pre-alert + reroute endpoints + socket events |
| 2026-04-10 | orchestrator (Claude) | Rewrote `seed.js` with RVITM hospitals (Apollo/Fortis/RV) |
| 2026-04-10 | orchestrator (Claude) | Added ESI-worsening reroute trigger in `riskScheduler.js` |
| 2026-04-10 | orchestrator (Claude) | Rewrote DispatcherPage: ranked recs, in-flight panel, reroute banner |
| 2026-04-10 | orchestrator (Claude) | Added LiveMap component (vanilla Leaflet) and wired into dispatcher |
| 2026-04-10 | orchestrator (Claude) | Wired HospitalPage pre-alert reception + accept handover |
| 2026-04-10 | orchestrator (Claude) | Added Driver/Paramedic tab split to AmbulancePage |
| 2026-04-10 | orchestrator (Claude) | Built mock HIS bed-board page (`/his`) |
| 2026-04-10 | orchestrator (Claude) | Rewrote top-level ARCHITECTURE/HARDCODED/DEMO_SCRIPT/README |
| 2026-04-10 | Antigravity | Smoke test passed end-to-end |
| 2026-04-10 | Gemini | Gap fixes: force-rescore btn, CallerPage fallback, SessionPage inline vitals, Cloudflare tunnel doc + API env var |
| 2026-04-11 | Antigravity | Merge bhuvandev branch: CallerPage two-panel layout, SessionPage hospital-switch card, AmbulancePage Leaflet driver map, PATCH /incidents/:id/hospital backend endpoint |
| 2026-04-11 | Antigravity | Clinical protocols: GCS, AVPU, Skin, Pupils, Shock Index, SAMPLE history tap-UI in Paramedic tab |
| 2026-04-11 | Antigravity | Scoring engine: deterministic GCS/AVPU/SpO2/SBP post-ML override in patientService.js |
| 2026-04-11 | Antigravity | SimulationPage: Vegacity→RVITM→BGS animated Leaflet map, fleet what-if, hospital alternatives, timeline |
| 2026-04-11 | Antigravity | LoginPage: split-screen video hero + simulation CTA button |
