# 🛡️ RapidResQ: AI-Powered Emergency & Civic Incident Reporting Ecosystem

An intelligent, real-time emergency triage and incident dispatch platform designed with a modern, high-fidelity UI/UX (matching the custom violet/coral SOS design language).

---

## 🌟 Key Features & Workflow

```
1. Citizen Reports (Photo/Video + Live Location Pin)
       │
       ▼
2. Express Backend / Neon PostgreSQL
       │
       ▼
3. Google Gemini AI Engine (Multimodal Visual Triage & Severity Rating)
       │
       ▼
4. Smart Department Routing
   ├── 🔥 Fire & Rescue Department
   ├── 🚑 Emergency Medical Services (EMS)
   ├── 🚓 Police & Security Dispatch
   └── 🏛️ Municipal Corporation / Public Works
       │
       ▼
5. Authority Command Center (Live Interactive Map, Instant Audio Siren, 1-Click Unit Dispatch)
       │
       ▼
6. Citizen Live Status Pipeline (Pending ➔ Acknowledged ➔ In Progress ➔ Resolved)
```

---

## 📱 Mobile App Screens (Citizen Portal)

1. **Screen 1 (Onboarding / Splash)**:
   - 3D Neumorphic Purple SOS Shield with floating status beacons
   - *"Help is Just a Tap Away"* title with gradient pill button
2. **Screen 2 (Home Dashboard)**:
   - Welcome banner with user initials avatar
   - Coral-Red Hero Emergency SOS Box with pulsating beacon
   - 3-Grid Quick Actions: *Share Location*, *Safety Timer (SafeWalk)*, *Voice Record*
   - Safety Tips Carousel
   - Recent Alerts List & Live Incident Feeds
   - Curved Floating Bottom Navigation Bar
3. **Screen 3 (Active SOS Mode)**:
   - Real-time SOS beacon with vibrating sound/visual siren
   - Submitted device location and accuracy with interactive mini-map
   - One-tap dial emergency contacts & dispatchers
4. **Screen 4 (Incident Reporting Flow)**:
   - Camera photo/video upload with live preview
   - Live AI Triage Assistant with instant hazard classification & priority detection
   - Category chips (Fire, Accident, Civic/Pothole, Crime)
   - Interactive Leaflet Map Pin Picker
   - Named reporting with device coordinates, accuracy, and capture time
5. **Screen 5 (Live Resolution Tracker)**:
   - Real-time resolution progress bar: `Pending Triage` ➔ `Acknowledged` ➔ `In Progress` ➔ `Resolved`
   - Assigned first responder badge & estimated arrival time (ETA)
   - Live audit timeline with responder notes and photo proof of resolution

---

## 🖥️ Authority Command Center

- **Tactical OpenStreetMap**: Live clustered incident pins color-coded by department & urgency.
- **Department Queue Switcher**: Dedicated filtered tabs for *Fire*, *Police*, *EMS*, and *Municipality*.
- **Incident Inspector**: Media inspection, AI confidence score, AI reasoning summary, and keyword extraction.
- **1-Click Dispatch & Triage**: Assign responder units (e.g., Engine 14, Medic 07), set ETAs, write status updates, and upload resolution proof.
- **Synthesized Web Audio Alerts**: Authentic emergency siren synthesizer and update chimes.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** v18+ (v24 tested)
- **npm** v10+

### 2. Install Dependencies
From the root directory:

```bash
npm install
```

The root install also installs the backend and frontend dependencies.

### 3. Run in Development

```bash
npm run dev
```

This starts the API on **`http://localhost:5000`** and the frontend on **`http://localhost:3000`**. To run them separately, use `npm run dev:backend` and `npm run dev:frontend`.

### 4. Open in Browser
Open **`http://localhost:3000`** in your browser.

- Use the top navigation bar to toggle between **📱 Citizen Mobile App**, **🖥️ Authority Command Center**, or **📱 ↔ 🖥️ Live Split Demo**.
- Click the simulation buttons (**Fire**, **Accident**, **Civic**) to test instant emergency injections.
- Allow **precise location** when the browser asks. Incident and SOS submissions reuse a device reading up to 5 minutes old (shown with its original capture time) and include its accuracy and capture time. Approximate locations are accepted; address lookup never blocks delivery.
- Browsers permit GPS on `localhost`; deployed copies must use HTTPS for live geolocation.

### 5. Production Build

```bash
npm run check
npm start
```

The production server hosts both the API and the built frontend at **`http://localhost:5000`**. Its health endpoint is **`/api/health`**.

---

## ⚙️ Configuration (.env)

Local development includes an in-memory demonstration. Use Neon PostgreSQL for shared, persistent reports:

In `backend/.env`:
```env
PORT=5000

# Optional: Google Gemini API Key for deep multimodal visual triage
GEMINI_API_KEY=your_gemini_api_key_here

# Required for persistent reports and Vercel deployments
DATABASE_URL=your_neon_postgres_connection_string
```

When hosting the frontend and API on different origins, copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_BASE_URL` to the backend origin before building. It is not needed for the default development or production setup.

---

## Deploy to Vercel

This repository includes `vercel.json` and a serverless Express entrypoint, so the
Vite frontend and `/api/*` routes deploy together from the repository root.

1. Import the repository into Vercel and leave **Root Directory** as `.`.
2. Vercel uses the checked-in build command and `frontend/dist` output directory.
3. Deploy over HTTPS and allow precise location access when prompted.

### Shared database (required on Vercel)

1. In the `rapid-res-q` project, open **Storage ? Create Database ? Neon**.
2. Review the provider terms, choose the Free plan, and connect the database to the project's deployment environments.
3. The integration supplies `DATABASE_URL` (the backend also accepts `POSTGRES_URL`). Keep this variable on the backend; never prefix it with `VITE_`.
4. Redeploy the project. `/api/health` must return `storage: "postgres"`.

The backend creates its incident and attachment tables automatically. Reports,
coordinates, timelines, and attachments are shared across serverless instances;
a success response is sent only after the report is saved. Demo reset is disabled
when a database is connected. Attachments are limited to 4 MB per request to fit
Vercel's function payload limit. For larger-scale media use, move attachments to
object storage.

Local development without `DATABASE_URL` keeps the seeded in-memory demonstration.
For persistent local data, set `DATABASE_URL` in the backend environment. Add
`GEMINI_API_KEY` only when enabling Gemini; triage falls back after a 5-second timeout.

Open **Authority Command Center ? Enable sound** once to allow incoming report
sounds in the browser. The dashboard polls every 3 seconds and shows connection
errors instead of silently appearing current. This project sends alerts to its own
command center; it does not send SMS or notify external emergency services.

Run `npm test` for GPS timeout, approximate-location, submission, and authority
status regression tests, followed by `npm run check` for lint and both builds.
