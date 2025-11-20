const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5050;
const LAGRANGE_BIN = process.env.LAGRANGE_BIN || path.join(__dirname, '../lagrange_opt/solver.exe');

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const validatePayload = (body) => {
  const required = ['minRate', 'maxPower', 'maxBandwidth', 'coeffA', 'coeffB', 'coeffC'];
  for (const key of required) {
    if (typeof body[key] !== 'number' || Number.isNaN(body[key]) || body[key] <= 0) {
      return `Invalid value for ${key}`;
    }
  }
  if (body.minRate >= body.maxBandwidth * 10) {
    return 'Unrealistic constraint: minRate too high for bandwidth ceiling';
  }
  return null;
};

const mockSolver = ({ minRate, maxPower, maxBandwidth, coeffA, coeffB, coeffC }) => {
  let x1 = minRate + 1;
  let x2 = Math.max(maxPower - 0.5, 0.1);
  let x3 = Math.max(maxBandwidth - 2, 0.5);
  const rate = 0.05;
  const objective = (a, b, c, r1, r2, r3) => a / r1 + b / r2 + c / r3;
  let prev = Infinity;
  for (let i = 0; i < 500; i++) {
    const current = objective(coeffA, coeffB, coeffC, x1, x2, x3);
    if (Math.abs(prev - current) < 0.001) break;
    prev = current;
    const grad1 = -coeffA / (x1 * x1);
    const grad2 = -coeffB / (x2 * x2);
    const grad3 = -coeffC / (x3 * x3);
    x1 = Math.max(minRate, x1 - rate * grad1);
    x2 = Math.min(maxPower, x2 - rate * grad2);
    x3 = Math.min(maxBandwidth, x3 - rate * grad3);
  }
  const latency = objective(coeffA, coeffB, coeffC, x1, x2, x3);
  return {
    rate: Number(x1.toFixed(2)),
    power: Number(x2.toFixed(2)),
    bandwidth: Number(x3.toFixed(2)),
    latency: Number(latency.toFixed(4)),
    engine: 'js-mock',
  };
};

const runCLagrange = (payload) =>
  new Promise((resolve, reject) => {
    if (!fs.existsSync(LAGRANGE_BIN)) {
      return reject(new Error('Lagrange executable missing'));
    }
    const args = [
      payload.minRate,
      payload.maxPower,
      payload.maxBandwidth,
      payload.coeffA,
      payload.coeffB,
      payload.coeffC,
    ].map(String);

    const proc = spawn(LAGRANGE_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `Solver exit code ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        return resolve({ ...parsed, engine: 'c-solver' });
      } catch (err) {
        return reject(new Error('Failed to parse solver output'));
      }
    });
  });

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/latency', (_req, res) => {
  const latency = Math.round(120 + Math.random() * 220);
  const status = latency < 220 ? 'optimal' : latency < 320 ? 'moderate' : 'high';
  res.json({ latency, status, updatedAt: Date.now() });
});

app.post('/optimize', async (req, res) => {
  const error = validatePayload(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  try {
    const result = await runCLagrange(req.body).catch(() => mockSolver(req.body));
    res.json({
      inputs: req.body,
      result,
      message: result.engine === 'c-solver' ? 'C solver used' : 'Fallback JS solver',
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown solver error' });
  }
});

app.listen(PORT, () => {
  console.log(`Assistive backend running on http://localhost:${PORT}`);
});

