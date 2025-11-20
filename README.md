# Optimized Assistive Vision App for Visually Impaired Users

**Version 1.0** - Web App with Lagrange Multiplier-Based Wireless Network Optimization

A complete web-based assistive system that:
- **Assistive Vision Module**: Captures webcam frames, runs real-time object detection (TensorFlow.js COCO-SSD), and provides audio feedback via Web Speech API
- **Wireless Network Optimization**: Implements Lagrange Multiplier Method to optimize data rate, transmission power, and bandwidth allocation for minimal latency
- **Developer Dashboard**: Visual interface to input constraints, run optimization, and view results with improvement metrics

## Structure

### Frontend (Root)
- `index.html`, `styles.css`, `app.js` – Main application UI served by Vercel
- Responsive design with two modes: Assistive Mode and Optimization Mode
- Real-time latency monitoring with visual indicators

### Backend API (Vercel Serverless)
- `api/latency.js` – Returns current network latency status
- `api/optimize.js` – **Lagrange Multiplier-based optimization solver** (JavaScript implementation)
- `api/health.js` – Health check endpoint

### C Optimization Engine
- `lagrange_opt/optimizer.c` – **Production-ready C implementation** of Lagrange Multiplier solver
- `lagrange_opt/Makefile` – Build configuration
- `lagrange_opt/README.md` – C engine documentation

### Additional Directories
- `frontend/` – Original design files (kept for reference)
- `backend/` – Optional Express scaffold for self-hosting

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

No extra build steps or environment variables are required.

## Optimization Implementation

The system implements **Lagrange Multiplier Method** for constrained optimization:

**Objective Function**: Minimize `L(x₁, x₂, x₃) = a/x₁ + b/x₂ + c/x₃`

**Constraints**:
- `x₁ ≥ R_min` (minimum data rate)
- `x₂ ≤ P_max` (maximum transmission power)
- `x₃ ≤ B_max` (maximum bandwidth)

**Current Implementation**:
- **JavaScript Solver** (`api/optimize.js`): Full Lagrange Multiplier implementation running in Vercel serverless functions
- **C Engine** (`lagrange_opt/optimizer.c`): Production-ready C implementation for local execution or future integration

The JavaScript solver provides:
- Iterative convergence with threshold < 0.001
- Constraint projection onto feasible region
- Improvement percentage calculation vs baseline
- Full result visualization in the dashboard

## Building the C Engine (Optional)

For local testing or integration:

```bash
cd lagrange_opt
make
./optimizer 5.0 2.5 20.0 1.2 0.8 0.5
```

See `lagrange_opt/README.md` for detailed documentation.

## Features

✅ Real-time object detection with audio feedback  
✅ Latency monitoring with automatic warnings  
✅ Lagrange Multiplier-based network optimization  
✅ Visual dashboard with improvement metrics  
✅ Accessible UI for visually impaired users  
✅ Vercel-ready deployment (zero config)

