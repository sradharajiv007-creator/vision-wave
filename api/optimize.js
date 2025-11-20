const validatePayload = (body = {}) => {
  const required = ['minRate', 'maxPower', 'maxBandwidth', 'coeffA', 'coeffB', 'coeffC'];
  for (const key of required) {
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value <= 0) {
      return `Invalid value for ${key}`;
    }
  }
  if (body.minRate >= body.maxBandwidth * 10) {
    return 'Unrealistic constraint: minRate too high for bandwidth ceiling';
  }
  return null;
};

const runSolver = ({ minRate, maxPower, maxBandwidth, coeffA, coeffB, coeffC }) => {
  let x1 = minRate + 1;
  let x2 = Math.max(maxPower - 0.5, 0.1);
  let x3 = Math.max(maxBandwidth - 2, 0.5);
  const step = 0.05;
  const objective = (a, b, c, r1, r2, r3) => a / r1 + b / r2 + c / r3;
  let prev = Infinity;
  for (let i = 0; i < 500; i++) {
    const current = objective(coeffA, coeffB, coeffC, x1, x2, x3);
    if (Math.abs(prev - current) < 0.001) break;
    prev = current;
    const grad1 = -coeffA / (x1 * x1);
    const grad2 = -coeffB / (x2 * x2);
    const grad3 = -coeffC / (x3 * x3);
    x1 = Math.max(minRate, x1 - step * grad1);
    x2 = Math.min(maxPower, x2 - step * grad2);
    x3 = Math.min(maxBandwidth, x3 - step * grad3);
  }
  return {
    rate: Number(x1.toFixed(2)),
    power: Number(x2.toFixed(2)),
    bandwidth: Number(x3.toFixed(2)),
    latency: Number((coeffA / x1 + coeffB / x2 + coeffC / x3).toFixed(4)),
  };
};

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const payload = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const error = validatePayload(payload);
  if (error) {
    return res.status(400).json({ error });
  }
  const result = runSolver(payload);
  return res.status(200).json({
    inputs: payload,
    result,
    message: 'Optimization complete (serverless JS solver)',
  });
};

