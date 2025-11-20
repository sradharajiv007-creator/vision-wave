# Assistive Vision & Network Optimization (Vercel-ready)

Prototype web app that:

- Streams webcam frames, runs on-device COCO-SSD via TensorFlow.js, and speaks detected objects.
- Monitors latency & warns users when the network degrades.
- Offers a developer dashboard to run an optimization loop (serverless Lagrange-inspired solver).

## Structure

- `index.html`, `styles.css`, `app.js` – static frontend served by Vercel/any HTTP host.
- `api/latency.js`, `api/optimize.js`, `api/health.js` – serverless endpoints automatically picked up by Vercel.
- `frontend/` – original design files (kept for reference). Root copies are used in production.
- `backend/` – optional Express scaffold if you want to self-host instead of using Vercel functions.

## Local Preview

Install any static dev server (example uses `serve`):

```bash
npm install -g serve
serve .
```

Open http://localhost:3000 (or the port that `serve` reports). API calls will still hit local serverless routes because Vercel emulation isn’t running; for full parity, use `vercel dev`.

## Deploying to Vercel

1. Install/Sign in to Vercel CLI (`npm i -g vercel`).
2. From the project root, run `vercel` (or `vercel --prod`) and select defaults.
   - Vercel detects static front assets automatically.
   - Files inside `api/` become serverless functions responding to `/api/*`.
3. Grant the deployed site permission to access the webcam when testing Assistive Mode.

No extra build steps or environment variables are required. The solver currently runs purely in JS; when the dedicated C binary is ready, place it behind another API route or external service and update the frontend fetch target accordingly.

