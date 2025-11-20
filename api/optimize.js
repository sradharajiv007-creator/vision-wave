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

/**
 * Lagrange Multiplier-Based Optimization Solver
 * 
 * Objective: Minimize L(x1, x2, x3) = a/x1 + b/x2 + c/x3
 * Constraints:
 *   g1: x1 >= R_min
 *   g2: x2 <= P_max
 *   g3: x3 <= B_max
 */
const runSolver = ({ minRate, maxPower, maxBandwidth, coeffA, coeffB, coeffC }) => {
  const MAX_ITERATIONS = 1000;
  const CONVERGENCE_THRESHOLD = 0.001;
  const STEP_SIZE = 0.01;
  
  // Objective function
  const objective = (x1, x2, x3) => coeffA / x1 + coeffB / x2 + coeffC / x3;
  
  // Constraint functions
  const g1 = (x1) => x1 - minRate;  // x1 >= R_min
  const g2 = (x2) => maxPower - x2;  // x2 <= P_max
  const g3 = (x3) => maxBandwidth - x3;  // x3 <= B_max
  
  // Initialize variables (feasible starting point)
  let x1 = minRate + 1.0;
  let x2 = maxPower * 0.8;
  let x3 = maxBandwidth * 0.8;
  
  // Initialize Lagrange multipliers (lambda >= 0 for inequality constraints)
  let lambda1 = 0.0;
  let lambda2 = 0.0;
  let lambda3 = 0.0;
  
  let prevLatency = Infinity;
  let iterations = 0;
  
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    iterations = iter + 1;
    
    // Compute gradients of objective function
    const gradX1 = -coeffA / (x1 * x1);
    const gradX2 = -coeffB / (x2 * x2);
    const gradX3 = -coeffC / (x3 * x3);
    
    // Compute constraint values
    const g1Val = g1(x1);
    const g2Val = g2(x2);
    const g3Val = g3(x3);
    
    // Update Lagrange multipliers (only if constraint is active/violated)
    if (g1Val < 0) {
      lambda1 = Math.max(0, lambda1 - STEP_SIZE * g1Val);
    } else {
      lambda1 = 0;
    }
    
    if (g2Val < 0) {
      lambda2 = Math.max(0, lambda2 - STEP_SIZE * g2Val);
    } else {
      lambda2 = 0;
    }
    
    if (g3Val < 0) {
      lambda3 = Math.max(0, lambda3 - STEP_SIZE * g3Val);
    } else {
      lambda3 = 0;
    }
    
    // Update variables using gradient descent with Lagrange multipliers
    // For g1: x1 >= R_min, so we add lambda1
    // For g2: x2 <= P_max, so we subtract lambda2
    // For g3: x3 <= B_max, so we subtract lambda3
    let newX1 = x1 - STEP_SIZE * (gradX1 + lambda1);
    let newX2 = x2 - STEP_SIZE * (gradX2 - lambda2);
    let newX3 = x3 - STEP_SIZE * (gradX3 - lambda3);
    
    // Project onto feasible region (apply constraints)
    newX1 = Math.max(newX1, minRate);
    newX2 = Math.min(newX2, maxPower);
    newX3 = Math.min(newX3, maxBandwidth);
    
    // Check convergence
    const currentLatency = objective(newX1, newX2, newX3);
    if (Math.abs(prevLatency - currentLatency) < CONVERGENCE_THRESHOLD) {
      x1 = newX1;
      x2 = newX2;
      x3 = newX3;
      break;
    }
    
    x1 = newX1;
    x2 = newX2;
    x3 = newX3;
    prevLatency = currentLatency;
  }
  
  const finalLatency = objective(x1, x2, x3);
  
  // Calculate baseline latency for comparison (using constraint boundaries)
  const baselineLatency = objective(minRate, maxPower * 0.5, maxBandwidth * 0.5);
  const improvement = ((baselineLatency - finalLatency) / baselineLatency) * 100;
  
  return {
    rate: Number(x1.toFixed(4)),
    power: Number(x2.toFixed(4)),
    bandwidth: Number(x3.toFixed(4)),
    latency: Number(finalLatency.toFixed(6)),
    iterations,
    baselineLatency: Number(baselineLatency.toFixed(6)),
    improvementPercent: Number(improvement.toFixed(2)),
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
    message: `Optimization complete using Lagrange Multiplier method (${result.iterations} iterations)`,
    method: 'Lagrange Multiplier',
  });
};

