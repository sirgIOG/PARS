## Problem Statement

India's pre-hospital emergency system suffers from:

- **Blind arrivals** — Hospitals find out what's coming when the stretcher rolls through the door
- **Manual pre-alerts** — A paramedic calls ahead, a nurse writes it on a sticky note, the surgeon never sees it
- **No triage en route** — Risk assessment only begins after the patient reaches the ER
- **Opaque fleet status** — Dispatchers rely on phone calls to figure out which ambulance is free
- **Wasted golden minutes** — The first 10 minutes in the ER are spent figuring out what's happening instead of treating it

> **Result:** Delayed care, unprepared trauma bays, untyped blood, and preventable deaths in the window that matters most.

---

## Our Solution

**PARS** replaces the phone-call-and-sticky-note chain with a live digital bridge between the ambulance and the hospital:

| Capability | How PARS Implements It |
|---|---|
| **Live Vitals Streaming** | Paramedics enter patient vitals on the road. Those numbers flow to the hospital dashboard in real time via **Socket.IO** WebSockets. |
| **AI Risk Scoring** | An **XGBoost** model scores each patient's mortality risk (HIGH / MEDIUM / LOW) automatically — the ER knows severity before arrival. |
| **Fleet Visibility** | Dispatchers see every ambulance's status (available, en route, maintenance) and every hospital's open bed count on a single screen. |
| **Pre-Alert Dashboard** | Hospital staff get a live heads-up display of incoming patients with auto-updating vitals and color-coded risk flags. |
| **Hub Optimization** | A simulation engine uses **weighted K-Means** + **OSMnx isochrones** to compute optimal ambulance station placements for a city. |
| **Public Caller Portal** | Anyone can report an emergency without logging in — the intake form captures location, symptoms, and complaint. |

---
